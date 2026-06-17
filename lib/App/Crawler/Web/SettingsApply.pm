package App::Crawler::Web::SettingsApply;

use strict;
use warnings;

use Dancer ':syntax';
use App::Crawler::Util::SettingOverride qw/apply_overrides/;

# Apply DB-backed setting_override rows to Dancer's settings cache at request
# start. The merge logic is shared with the backend worker (Worker::Runner), so
# UI-changed settings take effect on both the web/api surface (next request) and
# the discovery workers (next job pickup). See App::Crawler::Util::SettingOverride.
hook 'before' => sub { apply_overrides() };

1;
