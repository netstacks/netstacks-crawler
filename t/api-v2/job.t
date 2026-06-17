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

my $list = $test->request(GET '/api/v2/job');
isnt $list->code, 404, 'list endpoint exists';

my $one = $test->request(GET '/api/v2/job/999999');
isnt $one->code, 405, 'per-id GET exists';

my $post = $test->request(POST '/api/v2/job',
    Content_Type => 'application/json',
    Content      => '{"action":"discover","device":"10.0.0.1"}',
);
isnt $post->code, 404, 'submit endpoint exists';
ok $post->code == 401 || $post->code == 403 || $post->code == 302 || $post->code == 200 || $post->code == 400,
    'submit returns auth code or success';

done_testing;
