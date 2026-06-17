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

for my $sub (qw(
    /api/v2/device/10.0.0.1
    /api/v2/device/10.0.0.1/ports
    /api/v2/device/10.0.0.1/nodes
    /api/v2/device/10.0.0.1/vlans
    /api/v2/device/10.0.0.1/modules
    /api/v2/device/10.0.0.1/log
)) {
    my $res = $test->request(GET $sub);
    isnt $res->code, 405, "$sub method allowed";
    # Accept 200 (no auth), 302 (auth redirect), 401 (auth required), or 404 (no such device)
    ok $res->code == 302 || $res->code == 401 || $res->code == 200 || $res->code == 404,
       "$sub returns 200, 302, 401, or 404 — never 405";
}

done_testing;
