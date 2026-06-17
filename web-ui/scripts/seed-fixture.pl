#!/usr/bin/env perl
use strict;
use warnings;
use DBI;

my $url = $ENV{DATABASE_URL}
    or die "DATABASE_URL not set\n";

my ($u, $p, $h, $port, $db) =
    $url =~ m{^postgres(?:ql)?://(?:([^:]+)(?::([^@]*))?@)?([^:/]+)(?::(\d+))?/([^?]+)};
$port //= 5432;

my $dbh = DBI->connect("dbi:Pg:dbname=$db;host=$h;port=$port", $u, $p, { RaiseError => 1 });

$dbh->do(q{
    INSERT INTO device (ip, name, dns, vendor, model, os, location, contact, last_discover, creation)
    VALUES ('10.0.0.1', 'core-sw-01', 'core-sw-01.dc1', 'cisco', 'Catalyst 9300', 'IOS-XE 17.3.5', 'Bldg-A / DC1', 'netops', NOW(), NOW())
    ON CONFLICT (ip) DO UPDATE SET name = EXCLUDED.name
});

$dbh->do(qq{
    INSERT INTO device_port (ip, port, up, up_admin, speed, name)
    VALUES ('10.0.0.1', 'Gi1/0/$_', 'up', 'up', '1Gbps', 'fixture port $_')
    ON CONFLICT (ip, port) DO NOTHING
}) for 1..8;

print "Seeded fixture device 10.0.0.1 with 8 ports.\n";
