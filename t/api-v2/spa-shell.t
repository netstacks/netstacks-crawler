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

# /info has the banner now
my $info = $test->request(GET '/info');
is $info->code, 200, '/info 200';
my $body = decode_json($info->content);
is $body->{service}, 'netstacks-crawler', '/info banner';

# / serves SPA shell (or the placeholder when no build present)
my $root = $test->request(GET '/');
is $root->code, 200, '/ 200';
like $root->content_type, qr{text/html}, '/ html';

# Catch-all SPA fallback for client-side routes
my $deep = $test->request(GET '/devices/10.0.0.1/ports');
is $deep->code, 200, 'deep SPA route 200';
like $deep->content_type, qr{text/html}, 'deep SPA route html';

# X-Remote-User injection into HTML head
my $with_user = $test->request(GET '/', 'X-Remote-User' => 'alice@netstacks.net');
like $with_user->content, qr{<meta\s+name="x-remote-user"\s+content="alice\@netstacks\.net"}, 'remote user meta injected';

done_testing;
