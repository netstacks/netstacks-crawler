use utf8;
package App::Crawler::DB::Result::SNMPFilter;

use strict;
use warnings;

use base 'App::Crawler::DB::Result';
__PACKAGE__->table("snmp_filter");
__PACKAGE__->add_columns(
  "leaf",
  { data_type => "text", is_nullable => 0 },
  "subname",
  { data_type => "text", is_nullable => 0 },
);
__PACKAGE__->set_primary_key("leaf");

1;
