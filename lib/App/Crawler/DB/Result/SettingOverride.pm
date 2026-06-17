package App::Crawler::DB::Result::SettingOverride;

use strict;
use warnings;

use base 'App::Crawler::DB::Result';

__PACKAGE__->table('setting_override');
__PACKAGE__->add_columns(
    'key',        { data_type => 'text',      is_nullable => 0 },
    'value',      { data_type => 'jsonb',     is_nullable => 0 },
    'updated_at', { data_type => 'timestamp', is_nullable => 0, default_value => \'LOCALTIMESTAMP' },
    'updated_by', { data_type => 'text',      is_nullable => 1 },
);
__PACKAGE__->set_primary_key('key');

1;
