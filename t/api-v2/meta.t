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

subtest 'GET /info returns service banner JSON' => sub {
    my $res = $test->request(GET '/info');
    is $res->code, 200, '200 OK';
    like $res->content_type, qr{application/json}, 'JSON content-type';

    my $body = decode_json($res->content);
    is $body->{service}, 'netstacks-crawler', 'service name';
    is $body->{ui},      'disabled',           'ui state';
    ok defined $body->{version},               'version present';
    is $body->{docs},    '/swagger-ui',        'docs link';
};

subtest 'GET /api/v2/version' => sub {
    my $res = $test->request(GET '/api/v2/version');
    is $res->code, 200, '200 OK';
    my $body = decode_json($res->content);
    ok defined $body->{crawler_version}, 'crawler_version present';
    ok defined $body->{schema_version},  'schema_version present';
    is ref $body->{features}, 'HASH',    'features hash present';
    is $body->{features}{web_ui}, 0,     'features.web_ui = 0 when UI off';
};

done_testing;
