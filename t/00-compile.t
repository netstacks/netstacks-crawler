#!/usr/bin/env perl
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/lib";
use TestApp;
use Test::More;

use_ok('App::Crawler::Web') or BAIL_OUT('Web.pm did not compile');
done_testing;
