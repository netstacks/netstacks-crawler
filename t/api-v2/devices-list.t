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

for my $url (qw(
    /api/v2/devices
    /api/v2/devices?page=2&page_size=10
    /api/v2/devices?sort=name,desc
    /api/v2/devices?q=core
)) {
    my $res = $test->request(GET $url);
    isnt $res->code, 404, "$url is wired";
    ok $res->code == 200 || $res->code == 302 || $res->code == 401,
        "$url responded";
}

my $csv = $test->request(GET '/api/v2/devices.csv');
isnt $csv->code, 404, 'csv variant is wired';

done_testing;
