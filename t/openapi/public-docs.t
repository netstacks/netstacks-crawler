#!/usr/bin/env perl
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";
use TestApp qw(psgi_app);
use Test::More;
use Plack::Test;
use HTTP::Request::Common;
use JSON::PP qw(decode_json);

my $test = Plack::Test->create(psgi_app());

# ---- Public spec is served, credential-free, and correctly filtered ---------
my $res = $test->request(GET '/api/openapi.json');
is $res->code, 200, 'public /api/openapi.json reachable without a credential';
like $res->content_type, qr{application/json}, 'public spec is json';

my $spec = decode_json($res->content);

# Security is API-key only — no BasicAuth, no SSO header noise.
is_deeply [ sort keys %{ $spec->{securityDefinitions} } ], ['APIKeyHeader'],
    'public spec advertises only the APIKeyHeader security scheme';
unlike $res->content, qr/X-REMOTE_USER/,
    'internal X-REMOTE_USER param is stripped from the public spec';
unlike $res->content, qr/BasicAuth/, 'no BasicAuth in the public spec';

# Every documented path/method must be in the curated allow-list, GET only.
my %ALLOW = %App::Crawler::Web::API::PublicDocs::PUBLIC_PATHS;
for my $path (sort keys %{ $spec->{paths} }) {
    ok exists $ALLOW{$path}, "public path $path is allow-listed";
    my @verbs = grep { $_ ne 'parameters' } keys %{ $spec->{paths}{$path} };
    is_deeply [ sort @verbs ], ['get'], "public path $path exposes GET only";
}
ok exists $spec->{paths}{'/api/devices'}, 'baseline public path present';
ok !exists $spec->{paths}{'/api/admin/users'}, 'admin paths excluded from public spec';

# ---- Public UI + its assets are reachable under /api/ ------------------------
my $docs = $test->request(GET '/api/docs');
is $docs->code, 302, '/api/docs redirects to the trailing-slash UI';

my $ui = $test->request(GET '/api/docs/');
is $ui->code, 200, '/api/docs/ serves the UI';
like $ui->content_type, qr{text/html}, 'docs UI is html';
like $ui->content, qr{/api/openapi\.json}, 'docs UI points at the public spec';

my $asset = $test->request(GET '/api/docs/swagger-ui-bundle.js');
is $asset->code, 200, 'docs UI static assets serve under /api/docs/';

done_testing;
