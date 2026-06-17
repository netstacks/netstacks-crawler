use utf8;
package App::Crawler::DB::Result::ApiKey;

use strict;
use warnings;

# Static, non-expiring API keys. Each key belongs to a user (owner); presenting
# the key authenticates as that user, so it inherits the owner's roles. This is
# additive to the existing expiring login-token flow (users.token) — both work.
use base 'App::Crawler::DB::Result';
__PACKAGE__->table("api_key");
__PACKAGE__->add_columns(
  "id",
  {
    data_type         => "integer",
    is_auto_increment => 1,
    is_nullable       => 0,
    sequence          => "api_key_id_seq",
  },
  "label",
  { data_type => "text", is_nullable => 1 },
  "token",
  { data_type => "text", is_nullable => 0 },
  "username",
  { data_type => "varchar", is_nullable => 0, size => 50 },
  "active",
  { data_type => "boolean", default_value => \"true", is_nullable => 1 },
  "created",
  {
    data_type     => "timestamp",
    default_value => \"LOCALTIMESTAMP",
    is_nullable   => 1,
    original      => { default_value => \"LOCALTIMESTAMP" },
  },
  "last_used",
  { data_type => "timestamp", is_nullable => 1 },
);
__PACKAGE__->set_primary_key("id");
__PACKAGE__->add_unique_constraint(["token"]);

__PACKAGE__->belongs_to(
  owner => 'App::Crawler::DB::Result::User',
  { 'foreign.username' => 'self.username' },
  { join_type => 'LEFT', on_delete => 'CASCADE' },
);

1;
