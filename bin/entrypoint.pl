#!/usr/bin/env perl
use strict;
use warnings;

# Read the mounted deployment.yml, overlay CRAWLER_* env vars + DATABASE_URL,
# write the merged config back to a runtime location, then exec the original
# command.

use YAML::XS qw(LoadFile DumpFile);
use App::Crawler::Configuration qw(merge_env_overrides);

my $src = $ENV{CRAWLER_CONFIG} || '/etc/crawler/deployment.yml';
my $dst = '/home/crawler/environments/deployment.yml';

# Load (or start empty)
my $cfg = -e $src ? LoadFile($src) : {};
merge_env_overrides($cfg, \%ENV);

# Provide a default session_cookie_key if none configured. Persist it across
# container restarts by writing to a state file in /home/crawler.
if (!$cfg->{session_cookie_key}) {
    my $keyfile = '/home/crawler/.session_cookie_key';
    if (-e $keyfile) {
        chomp(my $k = do { local (@ARGV, $/) = ($keyfile); <> });
        $cfg->{session_cookie_key} = $k;
    } else {
        # Generate a hex key from /dev/urandom
        open my $u, '<', '/dev/urandom' or die "cannot open /dev/urandom: $!";
        binmode $u;
        read $u, my $buf, 32;
        close $u;
        my $k = unpack('H*', $buf);
        open my $fh, '>', $keyfile or die "cannot write $keyfile: $!";
        print $fh $k;
        close $fh;
        chmod 0600, $keyfile;
        $cfg->{session_cookie_key} = $k;
    }
}

mkdir '/home/crawler/environments' unless -d '/home/crawler/environments';
DumpFile($dst, $cfg);

# Point Netdisco at the merged config
$ENV{DANCER_ENVDIR}     = '/home/crawler/environments';
$ENV{DANCER_ENVIRONMENT} = 'deployment';

# Exec the role command
exec @ARGV or die "exec failed: $!";
