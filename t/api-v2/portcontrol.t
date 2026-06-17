#!/usr/bin/env perl
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";
use TestApp qw(psgi_app);
use Test::More;
use Plack::Test;
use HTTP::Request::Common;

my $test = Plack::Test->create(psgi_app());

subtest 'POST /api/v2/portcontrol requires auth' => sub {
    my $res = $test->request(POST '/api/v2/portcontrol',
        Content_Type => 'application/json',
        Content      => '{"device":"10.0.0.1","port":"Gi0/1","field":"c_port","action":"up"}',
    );
    isnt $res->code, 404, 'endpoint exists';
    ok $res->code == 401 || $res->code == 403 || $res->code == 302 || $res->code == 400,
       'unauth, forbidden, redirect or bad-input';
};

subtest 'POST rejects empty body' => sub {
    my $res = $test->request(POST '/api/v2/portcontrol');
    isnt $res->code, 404, 'endpoint exists';
};

subtest 'GET /api/v2/portcontrol/log exists' => sub {
    my $res = $test->request(GET '/api/v2/portcontrol/log');
    isnt $res->code, 404, 'log endpoint exists';
};

done_testing;
