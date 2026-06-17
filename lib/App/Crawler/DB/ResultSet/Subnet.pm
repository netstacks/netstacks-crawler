package App::Crawler::DB::ResultSet::Subnet;
use base 'App::Crawler::DB::ResultSet';

use strict;
use warnings;

__PACKAGE__->load_components(qw/
  +App::Crawler::DB::ExplicitLocking
/);

1;
