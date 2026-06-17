#!/usr/bin/env perl
use strict;
use warnings;
use Test::More;
use HTTP::Tiny;

if ($ENV{SKIP_DOCKER}) { plan skip_all => 'SKIP_DOCKER set'; }
my $docker = `command -v docker 2>/dev/null`;
chomp $docker;
plan skip_all => 'docker not on PATH' unless $docker;

my $compose = 'docker compose -f docker-compose.yaml';

diag "bringing up compose stack…";
is system("$compose down -v >/dev/null 2>&1; $compose up -d postgres") >> 8, 0,
    'postgres up';
sleep 5;

# Kill any process using port 5000 and immediately start services
# macOS ControlCenter AirPlay respawns quickly, so we race it
my $services_up = 0;
for my $attempt (1..3) {
    my $port_check = `lsof -ti :5000 2>/dev/null`;
    chomp $port_check;
    if ($port_check) {
        diag "attempt $attempt: killing PID $port_check on port 5000…";
        system("kill -9 $port_check 2>/dev/null");
    }
    my $rc = system("$compose up -d backend worker web >/dev/null 2>&1") >> 8;
    if ($rc == 0) {
        $services_up = 1;
        last;
    }
    sleep 1 if $attempt < 3;
}
ok $services_up, 'all services up';

my $ua = HTTP::Tiny->new(timeout => 5);
my $ok = 0;
for (1..30) {
    my $r = $ua->get('http://localhost:5000/health');
    if ($r->{success}) { $ok = 1; last }
    sleep 2;
}
ok $ok, '/health reachable within 60s';

my $v = $ua->get('http://localhost:5000/api/auth/whoami');
ok $v->{success}, '/api/auth/whoami returns 200';
like $v->{content}, qr/authenticated/, 'whoami payload looks right';

diag "tearing down compose stack…";
system("$compose down -v >/dev/null 2>&1");

done_testing;
