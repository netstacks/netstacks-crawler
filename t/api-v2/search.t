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

my $res = $test->request(GET '/api/v2/search?q=test&type=device');
isnt $res->code, 404, '/api/v2/search exists';
ok $res->code == 302 || $res->code == 401 || $res->code == 200, 'auth-gated or returns results';

for my $type (qw(node device port vlan)) {
    my $r = $test->request(GET "/api/v2/search?q=x&type=$type");
    isnt $r->code, 404, "type=$type supported";
}

done_testing;
