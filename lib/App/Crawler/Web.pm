package App::Crawler::Web;

use Dancer ':syntax';
use Dancer::Plugin::Ajax;

use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use Dancer::Plugin::Swagger;

use Dancer::Error;
use Dancer::Continuation::Route::ErrorSent;

use URI ();
use Socket6 (); # to ensure dependency is met
use HTML::Entities (); # to ensure dependency is met
use URI::QueryParam (); # part of URI, to add helper methods
use Path::Class 'dir';
use Module::Load ();
use Storable 'dclone';
use URI::Based;

use App::Crawler::Util::Web qw/
  request_is_api
  request_is_api_report
  request_is_api_search
/;

BEGIN {
  no warnings 'redefine';

  # https://github.com/PerlDancer/Dancer/issues/967
  *Dancer::_redirect = sub {
      my ($destination, $status) = @_;
      my $response = Dancer::SharedData->response;
      $response->status($status || 302);
      $response->headers('Location' => $destination);
  };

  # Send API errors as JSON; everything else gets the Dancer default.
  *Dancer::send_error = sub {
      my ($body, $status) = @_;
      if (request_is_api) {
        status $status || 400;
        $body = '' unless defined $body;
        Dancer::Continuation::Route::ErrorSent->new(
            return_value => to_json { error => $body, return_url => param('return_url') }
        )->throw;
      }
      Dancer::Continuation::Route::ErrorSent->new(
          return_value => Dancer::Error->new(
              message => $body,
              code => $status || 500)->render()
      )->throw;
  };

  # Tenant-aware uri_for so links built inside a tenant context land in
  # /t/<tenant>/...
  *Dancer::Request::uri_for = sub {
    my ($self, $part, $params, $dont_escape) = @_;
    my $uri = $self->base;

    if (vars->{'tenant'}) {
        $part = '/t/'. vars->{'tenant'} . $part;
    }

    my $base = $uri->path;
    $base =~ s|/$||;
    $part =~ s|^/||;
    $uri->path("$base/$part");

    $uri->query_form($params) if $params;

    return $dont_escape ? uri_unescape($uri->canonical) : $uri->canonical;
  };

  *Dancer::Request::path = sub {
    die "path is accessor not mutator" if scalar @_ > 1;
    my $self = shift;
    $self->_build_path() unless $self->{path};

    if (vars->{'tenant'} and $self->{path} !~ m{/t/}) {
        my $path = $self->{path};
        my $base = setting('path');
        my $tenant = '/t/' . vars->{'tenant'};

        $tenant = ($base . $tenant) if $base ne '/';
        $tenant .= '/' if $base eq '/';
        $path =~ s/^$base/$tenant/;

        return $path;
    }
    return $self->{path};
  };

  # same_site cookie support — from
  # https://github.com/PerlDancer/Dancer-Session-Cookie/issues/20
  *Dancer::Session::Cookie::_cookie_params = sub {
      my $self     = shift;
      my $name     = $self->session_name;
      my $duration = $self->_session_expires_as_duration;
      my %cookie   = (
          name      => $name,
          value     => $self->_cookie_value,
          path      => setting('session_cookie_path') || '/',
          domain    => setting('session_domain'),
          secure    => setting('session_secure'),
          http_only => setting("session_is_http_only") // 1,
          same_site => setting("session_same_site"),
      );
      if ( defined $duration ) {
          $cookie{expires} = time + $duration;
      }
      return %cookie;
  };
}

# Single unified API surface. CompatRedirects runs first to 308 any legacy
# /api/v[12]/... callers. Everything else is current /api/*. The React SPA
# is served by nginx — the backend is API-only.
BEGIN {
    my @api_modules = qw(
        API::CompatRedirects
        API::Meta
        API::TypeAhead
        API::Search
        API::Device
        API::DeviceDetails
        API::DeviceList
        API::Node
        API::PortControl
        API::Report
        API::Job
        API::Admin
        API::Inventory
        API::Statistics
        API::Objects
        API::Queue
        API::Import
        API::Auth
        SettingsApply
        AuthN
        Health
        Metrics
    );

    Module::Load::load("App::Crawler::Web::$_") for @api_modules;
}

# Load the session cookie signing key from the database. The container
# entrypoint installs a per-deployment persistent key into settings; this
# fallback is for dev/test where one hasn't been provisioned.
if (!setting('session_cookie_key')
    || setting('session_cookie_key') eq 'this_will_be_overridden_on_webapp_startup') {
    setting('session_cookie_key' => undef);
    setting('session_cookie_key' => 'this_is_for_testing_only')
      if $ENV{HARNESS_ACTIVE};
    eval {
      my $sessions = schema('netdisco')->resultset('Session');
      my $skey = $sessions->find({id => 'dancer_session_cookie_key'});
      setting('session_cookie_key' => $skey->get_column('a_session')) if $skey;
    };
}
Dancer::Session::Cookie::init(session);

# Tenant routing table — used by the multi-tenant /t/<tag>/... URL prefix.
{
    set('tenant_data' => {
        map { ( $_->{tag} => { displayname => $_->{'displayname'},
                               tag => $_->{'tag'},
                               path => config->{'url_base'}->with("/t/$_->{tag}")->path } ) }
            @{ setting('tenant_databases') },
            { tag => 'netdisco', displayname => (setting('database')->{displayname} || 'Default') }
    });
    config->{'tenant_data'}->{'netdisco'}->{'path'}
      = URI::Based->new((config->{path} eq '/') ? '' : config->{path})->path;
    set('tenant_tags' => [  map { $_->{'tag'} }
                           sort { $a->{'displayname'} cmp $b->{'displayname'} }
                                values %{ config->{'tenant_data'} } ]);
}

# Trim whitespace on inbound `q` params (search/filter).
hook 'before' => sub {
  params->{'q'} =~ s/^\s+|\s+$//g if param('q');
};

# Swagger submits literal "false" strings for unset bools; drop them so code
# that checks param-existence-as-truth doesn't get fooled.
hook 'before' => sub {
  return unless request_is_api_report or request_is_api_search;
  map {delete params->{$_} if params->{$_} eq 'false'} keys %{params()};
};

# Force JSON Content-Type on every API response (and rewrite tenant prefixes
# in the swagger.json output).
hook 'after' => sub {
    my $r = shift;

    if (request->path =~ m{/swagger\.json} and
        request->path eq uri_for('/swagger.json')->path
          and ref {} eq ref $r->content) {
        my $spec = dclone $r->content;

        if (vars->{'tenant'}) {
            my $base = setting('path');
            my $tenant = '/t/' . vars->{'tenant'};
            $tenant = ($base . $tenant) if $base ne '/';
            $tenant .= '/' if $base eq '/';

            foreach my $path (sort keys %{ $spec->{paths} }) {
                (my $newpath = $path) =~ s/^$base/$tenant/;
                $spec->{paths}->{$newpath} = delete $spec->{paths}->{$path};
            }
        }

        $r->content( to_json( $spec ) );
        header('Content-Type' => 'application/json');
    }

    if (request_is_api) {
        header('Content-Type' => 'application/json');
        $r->content( $r->content || '[]' );
    }
};

# Swagger documentation setup.
my $swagger = Dancer::Plugin::Swagger->instance;
my $swagger_doc = $swagger->doc;

$swagger_doc->{consumes} = 'application/json';
$swagger_doc->{produces} = 'application/json';
$swagger_doc->{tags} = [
  {name => 'meta',    description => 'Service version / health / info'},
  {name => 'device',  description => 'Devices and device-detail tabs'},
  {name => 'node',    description => 'Nodes (MAC/IP records)'},
  {name => 'port',    description => 'Per-port control and history'},
  {name => 'search',  description => 'Unified search across devices/nodes/ports'},
  {name => 'typeahead', description => 'Type-ahead suggestions'},
  {name => 'report',  description => 'Canned and adapter-backed reports'},
  {name => 'inventory', description => 'Fleet rollups: by platform, by software release'},
  {name => 'stats',   description => 'Operational statistics and history'},
  {name => 'admin',   description => 'Operational controls — workers, settings, jobs'},
  {name => 'job',     description => 'Job queue submit / inspect'},
];

$swagger_doc->{securityDefinitions} = {
  APIKeyHeader =>
    { type => 'apiKey', name => 'Authorization', in => 'header' },
  BasicAuth =>
    { type => 'basic'  },
};
$swagger_doc->{security} = [ { APIKeyHeader => [] } ];

if (setting('trust_x_remote_user')) {
    foreach my $path (keys %{ $swagger_doc->{paths} }) {
        foreach my $method (keys %{ $swagger_doc->{paths}->{$path} }) {
            unshift @{ $swagger_doc->{paths}->{$path}->{$method}->{parameters} }, {
              name => 'X-REMOTE_USER',
              description => 'API client user name',
              in => 'header',
              required => false,
              type => 'string',
            };
        }
    }
}

# Manually install Swagger UI routes because the plugin doesn't handle
# non-root hosting (so we cannot use show_ui(1)).
my $swagger_base = config->{plugins}->{Swagger}->{ui_url};

get $swagger_base => sub {
    Dancer::Plugin::Swagger->instance->doc->{schemes} = [ request->scheme ];
    redirect uri_for($swagger_base)->path
      . '/?url=' . uri_for('/swagger.json')->path;
};

get $swagger_base.'/' => sub {
    Dancer::Plugin::Swagger->instance->doc->{schemes} = [ request->scheme ];
    params->{url} or redirect uri_for($swagger_base)->path;
    send_file( 'swagger-ui/index.html' );
};

get $swagger_base.'/**' => sub {
    Dancer::Plugin::Swagger->instance->doc->{schemes} = [ request->scheme ];
    my $f = join '/', @{ (splat)[0] };
    send_file( 'swagger-ui/'. $f );
};

true;
