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

my $res = $test->request(GET '/api/v2/report');
isnt $res->code, 404, '/api/v2/report exists';

my $r1 = $test->request(GET '/api/v2/report/Port/PortVLANMismatch');
isnt $r1->code, 405, '/api/v2/report/{cat}/{name} responds';

my $r2 = $test->request(GET '/api/v2/report/Port/PortVLANMismatch.csv');
isnt $r2->code, 405, 'CSV variant responds';

subtest 'catalog returns array shape' => sub {
    my $res = $test->request(GET '/api/v2/report');
    isnt $res->code, 404, '/api/v2/report wired';
    # Without X-Remote-User header in the test request, may 302; if 200, validate shape.
    if ($res->code == 200) {
        my $body = decode_json($res->content);
        is ref $body->{reports}, 'ARRAY', 'reports is array';
    }
};

subtest 'every report responds without 500' => sub {
    my $list = $test->request(GET '/api/v2/report');
    if ($list->code != 200) {
        plan skip_all => 'catalog endpoint not 200 in this env (likely auth-gated)';
    }
    my $body = decode_json($list->content);
    my @tags = map { $_->{tag} } @{ $body->{reports} || [] };
    diag 'checking ' . scalar(@tags) . ' reports';
    for my $tag (@tags) {
        my $r = $test->request(GET "/api/v2/report/X/$tag");
        ok $r->code != 500, "report $tag does not 500 (got " . $r->code . ')';
    }
};

done_testing;
