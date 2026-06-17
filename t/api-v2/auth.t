#!/usr/bin/env perl
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";
use TestApp qw(psgi_app);
use Test::More;
use Plack::Test;
use HTTP::Request::Common;
use MIME::Base64 qw(encode_base64);
use JSON::PP qw(decode_json);

plan skip_all => 'TEST_DATABASE_URL not set' unless $ENV{TEST_DATABASE_URL};

my $test = Plack::Test->create(psgi_app());

# Bootstrap a test user via the existing helper (or raw INSERT).
my $user = "sp1tester_$$";
my $pass = 'sp1pass';
system(qq{netdisco-do useradd --user $user --password $pass --admin --api}) == 0
    or BAIL_OUT("could not create test user");

# Login
my $login = $test->request(
    POST '/login',
    Authorization => 'Basic ' . encode_base64("$user:$pass", ''),
);
is $login->code, 200, 'login succeeds';
my $body = decode_json($login->content);
ok my $token = $body->{api_key}, 'api_key returned';

# Authenticated call
my $auth = 'Basic ' . encode_base64("$user:$token", '');
my $call = $test->request(GET '/api/v2/version', Authorization => $auth);
is $call->code, 200, 'authenticated call succeeds';

# Logout
my $out = $test->request(POST '/logout', Authorization => $auth);
is $out->code, 200, 'logout succeeds';

# Subsequent call should 401
my $again = $test->request(GET '/api/v2/version', Authorization => $auth);
is $again->code, 401, 'token invalid after logout';

# Cleanup
system(qq{netdisco-do userdel --user $user});

done_testing;
