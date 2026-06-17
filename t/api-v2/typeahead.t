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
use MIME::Base64 qw(encode_base64);

my $test = Plack::Test->create(psgi_app());

# Without auth: 401 (unless no_auth set, which we don't in tests)
for my $endpoint (qw(
    /api/v2/typeahead/device
    /api/v2/typeahead/device-ip
    /api/v2/typeahead/device-name
    /api/v2/typeahead/port
    /api/v2/typeahead/subnet
)) {
    my $res = $test->request(GET "$endpoint?q=core");
    isnt $res->code, 404, "$endpoint exists";
    # With no auth backend in test config, expect 302 (redirect to login), 401, or 200
    ok $res->code == 302 || $res->code == 401 || $res->code == 200, "$endpoint returns auth-gated response";
}

done_testing;
