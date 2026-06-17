package App::Crawler::Util::SettingOverride;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::DBIC;
use JSON::PP qw/encode_json decode_json/;
use Exporter 'import';

our @EXPORT_OK = qw/load_overrides apply_overrides set_override delete_override/;

# Returns hashref keyed by dot-path key with the decoded value.
sub load_overrides {
    my %out;
    my $rs = schema('netdisco')->resultset('SettingOverride')->search;
    while (my $r = $rs->next) {
        my $v = $r->value;
        # JSONB returns either a Perl ref (when DBD::Pg auto-decodes) or a JSON
        # string — normalise to Perl scalars/refs.
        if (!ref($v) && defined($v)) {
            my $decoded = eval { decode_json($v) };
            $v = $decoded unless $@;
        }
        $out{ $r->key } = $v;
    }
    return \%out;
}

# Merge DB-backed setting_override rows into Dancer's live settings. Used by both
# the web before-hook (per request) and the backend Worker::Runner (per job
# pickup), so a setting changed in the UI reaches both surfaces. Supports
# top-level keys (set wholesale), schedule.<action>.<field> and dns.<field>
# dot-path keys (merged into the existing hashes).
sub apply_overrides {
    my $o = eval { load_overrides() };
    return if $@ || !$o || !keys %$o;

    my (%schedule_patch, %dns_patch);
    for my $k (keys %$o) {
        if ($k =~ /^schedule\.([^.]+)\.(when|enabled)$/) {
            $schedule_patch{$1} //= {};
            $schedule_patch{$1}{$2} = $o->{$k};
        } elsif ($k =~ /^dns\.(disabled)$/) {
            $dns_patch{$1} = $o->{$k};
        } else {
            setting($k => $o->{$k});
        }
    }

    if (keys %schedule_patch) {
        my %sched = %{ setting('schedule') || {} };
        for my $action (keys %schedule_patch) {
            $sched{$action} = { %{ $sched{$action} || {} }, %{ $schedule_patch{$action} } };
        }
        setting(schedule => \%sched);
    }
    if (keys %dns_patch) {
        my %dns = %{ setting('dns') || {} };
        @dns{ keys %dns_patch } = values %dns_patch;
        setting(dns => \%dns);
    }

    # The legacy `community`/`community_rw` settings are transformed into
    # device_auth stanzas once at startup (Configuration.pm via
    # DeviceAuth::fixup_device_auth). SNMP discovery reads device_auth, not
    # community — so a community override must rebuild those stanzas or it has no
    # effect on the workers. Replace the auto-derived community stanzas (untagged,
    # no user) with fresh ones; keep configured stanzas (tagged / user / cli).
    if (exists $o->{community} || exists $o->{community_rw}) {
        my @keep = grep {
            (defined $_->{tag} && length $_->{tag}) || $_->{user}
              || (($_->{driver} // '') eq 'cli')
        } @{ setting('device_auth') || [] };
        my @comm = (
            (map {{ read => 1, write => 0, no => [], only => ['group:__ANY__'],
                    community => $_, driver => 'snmp' }} @{ setting('community')    || [] }),
            (map {{ read => 0, write => 1, no => [], only => ['group:__ANY__'],
                    community => $_, driver => 'snmp' }} @{ setting('community_rw') || [] }),
        );
        setting(device_auth => [ @keep, @comm ]);
    }
    return 1;
}

sub set_override {
    my ($key, $value, $user) = @_;
    my $rs = schema('netdisco')->resultset('SettingOverride');
    my $encoded = encode_json($value);
    $rs->update_or_create({
        key        => $key,
        value      => \[ '?::jsonb', $encoded ],
        updated_at => \'LOCALTIMESTAMP',
        updated_by => $user,
    }, { key => 'primary' });
}

sub delete_override {
    my ($key) = @_;
    schema('netdisco')->resultset('SettingOverride')->search({ key => $key })->delete;
}

1;
