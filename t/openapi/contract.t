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

my $res = $test->request(GET '/swagger.json');
is $res->code, 200, 'swagger.json reachable';
like $res->content_type, qr{application/json}, 'json content-type';

my $doc = decode_json($res->content);
ok exists $doc->{paths}, 'paths exist';
ok exists $doc->{paths}{'/api/v2/version'},
   'documented endpoints include /api/v2/version';

# Every documented path must respond (to either 200/401/403, never 404).
for my $path (sort keys %{ $doc->{paths} }) {
    # Skip parameterized paths — the contract test only checks discoverability,
    # not semantic correctness. Resource-specific tests cover behavior.
    next if $path =~ m{\{};
    next if $path !~ m{^/api/v2/};

    my $check = $test->request(GET $path);
    isnt $check->code, 404, "$path is wired (got " . $check->code . ")";
}

done_testing;
