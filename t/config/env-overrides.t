#!/usr/bin/env perl
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/../lib";
use TestApp;
use Test::More;
use App::Crawler::Configuration qw(merge_env_overrides);

my $cfg = {
    web_ui   => { enabled => 0 },
    database => { dsn => 'dbi:Pg:dbname=netdisco' },
};

local %ENV = (
    NETDISCO_WEB_UI__ENABLED => '1',
    DATABASE_URL             => 'postgresql://x:y@hostX/dbY',
);

merge_env_overrides($cfg, \%ENV);

is $cfg->{web_ui}{enabled}, 1, 'WEB_UI__ENABLED merged';
like $cfg->{database}{dsn}, qr/dbname=dbY/, 'DATABASE_URL parsed into dsn';
like $cfg->{database}{host} || '', qr/hostX/, 'host parsed';

done_testing;
