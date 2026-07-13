package App::Crawler::Web::API::PublicDocs;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Storable 'dclone';

use App::Crawler; # a safe noop but needed for standalone testing

# ---------------------------------------------------------------------------
# Public API surface.
#
# The full Swagger doc (/swagger.json + /swagger-ui) documents every internal
# endpoint and stays behind the SSO perimeter. This module serves a *curated,
# public* subset for external API-key clients: a filtered spec at
# /api/openapi.json and a browsable UI at /api/docs. Both live under /api/ so
# the ALB's /api/* allow-rule reaches them without interactive OIDC, and the
# AuthN before-hook exempts them from credential checks.
#
# %PUBLIC_PATHS is the ONE place to curate the public surface: map each public
# path (exactly as it appears as a key in the generated Swagger doc — note the
# {ip}/{mac} brace form, not Dancer's :ip) to the HTTP methods to expose.
# ---------------------------------------------------------------------------
our %PUBLIC_PATHS = (
    '/api/version'                     => ['get'],

    # Device inventory + per-device detail tabs
    '/api/devices'                     => ['get'],
    '/api/device/{ip}'                 => ['get'],
    '/api/device/{ip}/details'         => ['get'],
    '/api/device/{ip}/log'             => ['get'],
    '/api/device/{ip}/modules'         => ['get'],
    '/api/device/{ip}/nodes'           => ['get'],
    '/api/device/{ip}/ports'           => ['get'],
    '/api/device/{ip}/vlans'           => ['get'],

    # Nodes (MAC/IP records)
    '/api/node/{mac}'                  => ['get'],
    '/api/node/{mac}/history'          => ['get'],

    # Search + type-ahead
    '/api/search'                      => ['get'],
    '/api/typeahead/device'            => ['get'],
    '/api/typeahead/device-ip'         => ['get'],
    '/api/typeahead/device-name'       => ['get'],
    '/api/typeahead/port'              => ['get'],
    '/api/typeahead/subnet'            => ['get'],

    # Reports + rollups
    '/api/report'                      => ['get'],
    '/api/report/{category}/{tag}'     => ['get'],
    '/api/inventory'                   => ['get'],

    # Statistics
    '/api/stats/summary'               => ['get'],
    '/api/stats/operational'           => ['get'],
);

# Build the public spec from the live global Swagger doc. Done per-request (the
# doc is fully populated by the time any request arrives, and this lets us set
# `schemes` from the current request) but cheap: a deep clone + a filter.
sub _public_spec {
    my $full = Dancer::Plugin::Swagger->instance->doc;
    my $spec = dclone $full;

    # Keep only curated (path, method) pairs.
    foreach my $path (keys %{ $spec->{paths} }) {
        my $want = $PUBLIC_PATHS{$path};
        if (not $want) {
            delete $spec->{paths}->{$path};
            next;
        }
        my %keep = map { lc($_) => 1 } @$want;
        foreach my $method (keys %{ $spec->{paths}->{$path} }) {
            # 'parameters' is a path-level sibling of the method verbs; keep it.
            next if $method eq 'parameters';
            delete $spec->{paths}->{$path}->{$method}
              unless $keep{ lc $method };
        }
        delete $spec->{paths}->{$path}
          unless grep { $_ ne 'parameters' } keys %{ $spec->{paths}->{$path} };
    }

    # Strip the internal-only X-REMOTE_USER header param that Web.pm injects
    # into every op when trust_x_remote_user is set — meaningless to a public
    # API-key client and confusing (it looks spoofable).
    foreach my $path (keys %{ $spec->{paths} }) {
        foreach my $method (keys %{ $spec->{paths}->{$path} }) {
            my $op = $spec->{paths}->{$path}->{$method};
            next unless ref $op eq 'HASH' and ref $op->{parameters} eq 'ARRAY';
            $op->{parameters} = [
              grep { not (ref $_ eq 'HASH'
                          and ($_->{name} // '') eq 'X-REMOTE_USER') }
                @{ $op->{parameters} }
            ];
            # Public auth is the API key only.
            $op->{security} = [ { APIKeyHeader => [] } ];
        }
    }

    # Prune the top-level tag list to only tags still used by a surviving
    # operation — otherwise Swagger UI renders empty "admin"/"job"/"port"
    # accordion sections for categories the public API doesn't expose.
    my %used_tags;
    foreach my $path (keys %{ $spec->{paths} }) {
        foreach my $method (keys %{ $spec->{paths}->{$path} }) {
            my $op = $spec->{paths}->{$path}->{$method};
            next unless ref $op eq 'HASH' and ref $op->{tags} eq 'ARRAY';
            $used_tags{$_} = 1 for @{ $op->{tags} };
        }
    }
    if (ref $spec->{tags} eq 'ARRAY') {
        $spec->{tags} = [ grep { $used_tags{ $_->{name} // '' } } @{ $spec->{tags} } ];
    }

    # Public docs advertise API-key auth only (no BasicAuth / SSO header).
    $spec->{securityDefinitions} = {
      APIKeyHeader => {
        type => 'apiKey',
        name => 'Authorization',
        in   => 'header',
        description =>
          'API key issued under Admin -> API Keys. Send as'
          . ' "Authorization: Apikey <token>" (or "Bearer <token>").',
      },
    };
    $spec->{security} = [ { APIKeyHeader => [] } ];

    $spec->{info}->{title} = 'NetStacks Crawler API';
    $spec->{info}->{description} =
        'Public, read-only API for the NetStacks Crawler. Authenticate with an'
      . ' API key (Admin -> API Keys) via the Authorization header.';

    $spec->{schemes} = [ request->scheme ];

    return $spec;
}

# Public spec. Served under /api/ so the ALB allow-rule reaches it; the AuthN
# before-hook exempts it from auth.
get '/api/openapi.json' => sub {
    header('Content-Type' => 'application/json');
    return to_json( _public_spec(), { canonical => 1 } );
};

# Browsable public UI. Reuses the shipped swagger-ui assets, served under
# /api/docs/ so an unauthenticated external client can reach both the page and
# its assets through the ALB allow-rule. A trailing slash is required so the
# page's relative "./asset" references resolve under /api/docs/.
get '/api/docs' => sub { redirect uri_for('/api/docs/')->path };

get '/api/docs/' => sub {
    my $spec_url = uri_for('/api/openapi.json')->path;
    header('Content-Type' => 'text/html; charset=utf-8');
    return <<"HTML";
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>NetStacks Crawler API</title>
    <script src="./swagger-ui-json-tree-plugin.js"></script>
    <link rel="stylesheet" type="text/css" href="./swagger-ui.css">
    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32">
    <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16">
    <style>
      html { box-sizing: border-box; overflow-y: scroll; }
      *, *:before, *:after { box-sizing: inherit; }
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js"></script>
    <script src="./swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function() {
        SwaggerUIStandalonePreset.unshift(jsonTreePlugin.default);
        window.ui = SwaggerUIBundle({
          url: "$spec_url",
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [ SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset ],
          plugins: [ SwaggerUIBundle.plugins.DownloadUrl ],
          layout: "StandaloneLayout",
          apisSorter: "alpha",
          operationsSorter: "alpha",
          docExpansion: "none"
        });
      }
    </script>
  </body>
</html>
HTML
};

# Static assets for the public UI, drawn from the same swagger-ui dist that
# backs /swagger-ui (see Web.pm).
get '/api/docs/**' => sub {
    my $f = join '/', @{ (splat)[0] };
    send_file( 'swagger-ui/'. $f );
};

true;
