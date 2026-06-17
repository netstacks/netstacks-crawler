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

for my $path (qw(
    /api/v2/node/aabbccddeeff
    /api/v2/node/aabbccddeeff/history
)) {
    my $res = $test->request(GET $path);
    isnt $res->code, 405, "$path method allowed";
    # 200 (no auth), 302 (auth redirect), 401 (auth required), or 404 (no such node) all OK
    ok $res->code == 200 || $res->code == 302 || $res->code == 401 || $res->code == 404,
       "$path responded with valid code (got " . $res->code . ")";
}

done_testing;
