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
my $res = $test->request(GET '/api/v2/device/10.0.0.1/details');
isnt $res->code, 404, '/details exists';
isnt $res->code, 405, 'GET allowed';
done_testing;
