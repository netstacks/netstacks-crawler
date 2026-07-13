package App::Crawler::Web::AuthN;

use Dancer ':syntax';
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use Dancer::Plugin::Swagger;

use App::Crawler; # a safe noop but needed for standalone testing
use App::Crawler::Util::Web qw/request_is_api ensure_remote_user/;
use MIME::Base64;
use URI::Based;

# ensure that regardless of where the user is redirected, we have a link
# back to the page they requested.
hook 'before' => sub {
    params->{return_url} ||= ((request->path ne uri_for('/')->path)
      ? request->uri : uri_for(setting('web_home'))->path);
};

# try to find a valid username according to headers
# or configuration settings
sub _get_delegated_authn_user {
  my (%opt) = @_;
  my $username = undef;

  if (setting('trust_x_remote_user')
    and scalar request->header('X-REMOTE_USER')
    and length scalar request->header('X-REMOTE_USER')) {

      ($username = scalar request->header('X-REMOTE_USER')) =~ s/@[^@]*$//;
  }
  elsif (setting('trust_remote_user')
    and defined $ENV{REMOTE_USER}
    and length  $ENV{REMOTE_USER}) {

      ($username = $ENV{REMOTE_USER}) =~ s/@[^@]*$//;
  }
  # The no_auth "open mode" guest applies ONLY to the browser UI. API requests
  # (/api/*) are always credential-gated — a valid API key, or a verified SSO
  # identity for the SPA — so callers pass no_guest => 1 for API paths. This
  # keeps the API controlled by the API-keys admin UI even when authentication
  # is turned off in settings.
  elsif (setting('no_auth') and not $opt{no_guest}) {
      $username = 'guest';
  }

  return unless $username;

  # from the internals of Dancer::Plugin::Auth::Extensible
  my $provider = Dancer::Plugin::Auth::Extensible::auth_provider('users');

  # may synthesize a user if validate_remote_user=false
  return $provider->get_user_details($username);
}

# Dancer will create a session if it sees its own cookie. For the API and also
# various auto login options we need to bootstrap the session instead. If no
# auth data passed, then the hook simply returns, no session is set, and the
# user is redirected to login page.
hook 'before' => sub {
    # return if request is for endpoints not requiring a session
    return if (
      request->path eq uri_for('/login')->path
      or request->path eq uri_for('/logout')->path
      or request->path eq uri_for('/swagger.json')->path
      or index(request->path, uri_for('/swagger-ui')->path) == 0
      # Public API docs: curated spec + browsable UI, intentionally credential-free
      or request->path eq uri_for('/api/openapi.json')->path
      or index(request->path, uri_for('/api/docs')->path) == 0
      # SPA session login/logout/whoami manage their own auth; don't gate them
      or index(request->path, uri_for('/api/auth/')->path) == 0
      or (setting('health_path')  and request->path eq uri_for(setting('health_path'))->path)
      or (setting('metrics_path') and request->path eq uri_for(setting('metrics_path'))->path)
    );

    # A presented API credential (Authorization header) is authoritative, so
    # drop any ambient cookie to stop it shadowing token/key auth. But the SPA
    # *is* the UI and authenticates /api/* via a session cookie after a local
    # login — so only destroy when a credential is actually being passed.
    session->destroy if (request_is_api and request->header('Authorization'));

    # ...otherwise, we can short circuit if Dancer reads its cookie OK
    return if session('logged_in_user');

    # Any request under /api/ (minus the exemptions returned above) is API
    # traffic and must be credential-gated: an API key, or a verified SSO
    # identity for the SPA. The no_auth open-mode guest is never handed API
    # access, so the API stays controlled by the API-keys admin UI regardless
    # of the no_auth toggle. (Path-based, not request_is_api, so a client that
    # omits the JSON Accept header can't slip past into guest access.)
    my $is_api = (index(request->path, uri_for('/api/')->path) == 0);

    my $delegated = _get_delegated_authn_user(no_guest => $is_api);

    # An explicit API credential always wins, ahead of the delegated
    # (X-Remote-User) handling below — otherwise the "delegated configured but no
    # header" guard would shadow credential auth. Check static, non-expiring API
    # keys first, then fall back to the legacy (expiring) login token. Both
    # mechanisms coexist.
    if (request_is_api and request->header('Authorization')) {
        my $provider = Dancer::Plugin::Auth::Extensible::auth_provider('users');
        my $hdr = request->header('Authorization');
        (my $bare = $hdr) =~ s/^(?:Apikey|Bearer)\s+//i;

        my $key = eval {
          schema('netdisco')->resultset('ApiKey')->find({ token => $bare });
        };
        if ($key and $key->in_storage and $key->active) {
            my $owner = eval { $key->owner };
            unless ($owner and defined $owner->active and not $owner->active) {
                eval { $key->update({ last_used => \'LOCALTIMESTAMP' }) };
                session(logged_in_user => $key->username);
                session(logged_in_user_realm => 'users');
                return;
            }
            # owner disabled — ignore the key, fall through
        }

        if (my $user = $provider->validate_api_token($hdr)) {
            session(logged_in_user => $user->username);
            session(logged_in_user_realm => 'users');
            return;
        }
        # invalid credential: fall through — a delegated header may still apply,
        # otherwise the route's require_role will 401.
    }

    # this ordering allows override of delegated authN if given creds

    # protect against delegated authN config but no valid user
    if ((not $delegated) and
      (setting('trust_x_remote_user') or setting('trust_remote_user'))) {
        session->destroy;
        # When UI is disabled, do not redirect unauthenticated UI-style
        # requests to a login page. Let API routes 401 themselves;
        # let everything else 404.
        if (setting('web_ui') && setting('web_ui')->{enabled}) {
            request->path_info('/');
        }
    }
    elsif ($delegated and not (defined $delegated->active and not $delegated->active)) {
        # Persist the SSO/remote identity as a real row (read-only by default)
        # so it gains the `api` role and is manageable under Admin → Users. A
        # synthesized in-memory user has no DB row and therefore no roles.
        ensure_remote_user($delegated->username)
          if not $delegated->in_storage;
        session(logged_in_user => $delegated->username);
        session(logged_in_user_realm => 'users');
    }
    else {
        # user has no AuthN (or a disabled account) - force to handler for '/'
        # When UI is disabled, do not redirect unauthenticated UI-style
        # requests to a login page. Let API routes 401 themselves;
        # let everything else 404.
        if (setting('web_ui') && setting('web_ui')->{enabled}) {
            request->path_info('/');
        }
    }

    # API clients (curl, swagger-ui, scripts) must get a clean 401 when
    # unauthenticated — never a 302 redirect to the login page, which a client
    # follows to a 200 HTML page and mistakes for success. This pre-empts both
    # require_role's redirect and the SPA reroute above. Path-based on /api/ (as
    # well as request_is_api) so an API caller without the JSON Accept header
    # still gets 401, and so the no_auth guest can never reach an API route.
    if (($is_api or request_is_api) and not session('logged_in_user')) {
        status 401;
        header('Content-Type' => 'application/json');
        halt(to_json({ error => 'authentication required' }));
    }
};

# override default login_handler so we can log access in the database
swagger_path {
  description => 'Obtain an API Key',
  tags => ['General'],
  path => (setting('url_base') ? setting('url_base')->with('/login')->path : '/login'),
  parameters => [],
  responses => { default => { examples => {
    'application/json' => { api_key => 'cc9d5c02d8898e5728b7d7a0339c0785' } } },
  },
},
post '/login' => sub {
    my $api = ((request->accept and request->accept =~ m/(?:json|javascript)/) ? true : false);

    # from the internals of Dancer::Plugin::Auth::Extensible
    my $provider = Dancer::Plugin::Auth::Extensible::auth_provider('users');

    # get authN data from BasicAuth header used by API, put into params
    my $authheader = request->header('Authorization');
    if (defined $authheader and $authheader =~ /^Basic (.*)$/i) {
        my ($u, $p) = split(m/:/, (MIME::Base64::decode($1) || ":"));
        params->{username} = $u;
        params->{password} = $p;
    }

    # validate authN
    my ($success, $realm) = authenticate_user(param('username'),param('password'));

    # or try to get user from somewhere else
    my $delegated = _get_delegated_authn_user();

    if (($success and not
          # protect against delegated authN config but no valid user (then must ignore params)
          (not $delegated and (setting('trust_x_remote_user') or setting('trust_remote_user'))))
        or $delegated) {

        # this ordering allows override of delegated user if given creds
        my $user = ($success ? $provider->get_user_details(param('username'))
                             : $delegated);

        session logged_in_user => $user->username;
        session logged_in_fullname => ($user->fullname || '');
        session logged_in_user_realm => ($realm || 'users');

        schema('netdisco')->resultset('UserLog')->create({
          username => session('logged_in_user'),
          userip => request->remote_address,
          event => (sprintf 'Login (%s)', ($api ? 'API' : 'WebUI')),
          details => param('return_url'),
        });
        $user->update({ last_on => \'LOCALTIMESTAMP' });

        if ($api) {
            header('Content-Type' => 'application/json');

            # if there's a current valid token then reissue it and reset timer
            $user->update({
              token_from => time,
              ($provider->validate_api_token($user->token)
                ? () : (token => \'md5(random()::text)')),
            })->discard_changes();
            return to_json { api_key => $user->token };
        }

        redirect ((scalar URI::Based->new(param('return_url'))->path_query) || '/');
    }
    else {
        # invalidate session cookie
        session->destroy;

        schema('netdisco')->resultset('UserLog')->create({
          username => param('username'),
          userip => request->remote_address,
          event => (sprintf 'Login Failure (%s)', ($api ? 'API' : 'WebUI')),
          details => param('return_url'),
        });

        if ($api) {
            header('Content-Type' => 'application/json');
            status('unauthorized');
            return to_json { error => 'authentication failed' };
        }

        vars->{login_failed}++;
        forward uri_for('/login'),
          { login_failed => 1, return_url => param('return_url') },
          { method => 'GET' };
    }
};

# ugh, *puke*, but D::P::Swagger has no way to set this with swagger_path
# must be after the path is declared, above.
Dancer::Plugin::Swagger->instance->doc
  ->{paths}->{ (setting('url_base') ? setting('url_base')->with('/login')->path : '/login') }
  ->{post}->{security}->[0]->{BasicAuth} = [];

# we override the default login_handler, so logout has to be handled as well
swagger_path {
  description => 'Destroy user API Key and session cookie',
  tags => ['General'],
  path => (setting('url_base') ? setting('url_base')->with('/logout')->path : '/logout'),
  parameters => [],
  responses => { default => { examples => { 'application/json' => {} } } },
},
get '/logout' => sub {
    my $api = ((request->accept and request->accept =~ m/(?:json|javascript)/) ? true : false);

    # clear out API token
    my $user = schema('netdisco')->resultset('User')
      ->find({ username => session('logged_in_user')});
    $user->update({token => undef, token_from => undef})->discard_changes()
      if $user and $user->in_storage;

    # invalidate session cookie
    session->destroy;

    schema('netdisco')->resultset('UserLog')->create({
      username => session('logged_in_user'),
      userip => request->remote_address,
      event => (sprintf 'Logout (%s)', ($api ? 'API' : 'WebUI')),
      details => '',
    });

    if ($api) {
        header('Content-Type' => 'application/json');
        return to_json {};
    }

    redirect uri_for(setting('web_home'))->path;
};

# user redirected here when require_role does not succeed
any qr{^/(?:login(?:/denied)?)?} => sub {
    my $api = ((request->accept and request->accept =~ m/(?:json|javascript)/) ? true : false);

    if ($api) {
      header('Content-Type' => 'application/json');
      status('unauthorized');
      return to_json {
        error => 'not authorized',
        return_url => param('return_url'),
      };
    }
    elsif (defined request->header('X-Requested-With')
           and request->header('X-Requested-With') eq 'XMLHttpRequest') {
      status('unauthorized');
      return '<div class="span2 alert alert-error"><i class="icon-ban-circle"></i> Error: unauthorized.</div>';
    }
    else {
      # No legacy login form anymore — the SPA assumes a perimeter that sets
      # X-Remote-User. Non-API browser hits get a 401 with the JSON error so
      # whatever's in front of us can decide what to do.
      status 'unauthorized';
      header('Content-Type' => 'application/json');
      return to_json { error => 'not authorized', return_url => param('return_url') };
    }
};

true;
