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

my $r1 = $test->request(POST '/api/v2/admin/renumber');
isnt $r1->code, 404, 'renumber exists';

my $r2 = $test->request(POST '/api/v2/admin/snapshot',
    Content_Type => 'application/json',
    Content      => '{"device":"10.0.0.1"}',
);
isnt $r2->code, 404, 'snapshot create exists';

my $r3 = $test->request(GET '/api/v2/admin/snapshot/10.0.0.1');
isnt $r3->code, 404, 'snapshot get exists';

my $r4 = $test->request(HTTP::Request->new(DELETE => '/api/v2/admin/snapshot/10.0.0.1'));
isnt $r4->code, 404, 'snapshot delete exists';

done_testing;
