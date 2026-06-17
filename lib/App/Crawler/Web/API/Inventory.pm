package App::Crawler::Web::API::Inventory;
use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;

# Two GROUP BY aggregations over the device table — the same view legacy
# Netdisco's /inventory page exposes. The SPA renders them side-by-side.

swagger_path {
    description => 'Fleet inventory aggregations (platform + software release)',
    tags        => ['inventory'],
    responses   => { default => {} },
},
get '/api/inventory' => require_role api => sub {
    content_type 'application/json';

    my $rs = schema('netdisco')->resultset('Device');

    my @by_platform = $rs->search(
        {},
        {
            select   => ['vendor', 'model', { count => 'ip', -as => 'count' }],
            as       => [qw/ vendor model count /],
            group_by => [qw/ vendor model /],
            order_by => [{ -asc => 'vendor' }, { -asc => 'model' }],
        },
    )->hri->all;

    # When device.model is empty or a bare SNMP-type suffix (e.g. ".154"),
    # substitute the chassis description from device_module and re-merge any
    # rows that collapse to the same (vendor, model) bucket.
    {
        my %fixed;
        my @ordered;
        for my $row (@by_platform) {
            my $bogus = !defined $row->{model} || $row->{model} eq '' || $row->{model} =~ /^\.?\d+$/;
            if ($bogus) {
                my $dev = schema('netdisco')->resultset('Device')->search(
                    { vendor => $row->{vendor}, model => $row->{model} },
                    { columns => ['ip'], rows => 1 },
                )->first;
                if ($dev) {
                    my $chassis = schema('netdisco')->resultset('DeviceModule')->search(
                        { ip => $dev->ip, parent => undef },
                        { columns => [qw/ name description /], rows => 1 },
                    )->first;
                    if ($chassis) {
                        my $name = $chassis->name // '';
                        my $desc = $chassis->description // '';
                        my $cm;
                        if ($name =~ /\S/) { ($cm = $name) =~ s/-CHAS\b//; }
                        elsif ($desc =~ /\S/) {
                            ($cm = $desc) =~ s/^(?:Juniper|Cisco|Arista|HP|Dell)\s+//i;
                            $cm =~ s/\s+(?:Switch|Router|Chassis)\s*$//i;
                        }
                        $row->{model} = $cm if defined $cm && length $cm;
                    }
                }
            }
            my $key = ($row->{vendor} // '') . '|' . ($row->{model} // '');
            if (exists $fixed{$key}) {
                $fixed{$key}{count} += $row->{count};
            }
            else {
                $fixed{$key} = $row;
                push @ordered, $key;
            }
        }
        @by_platform = map { $fixed{$_} } @ordered;
    }

    my @by_software = $rs->search(
        {},
        {
            select   => ['os', 'os_ver', { count => 'ip', -as => 'count' }],
            as       => [qw/ os version count /],
            group_by => [qw/ os os_ver /],
            order_by => [{ -asc => 'os' }, { -asc => 'os_ver' }],
        },
    )->hri->all;

    return to_json {
        by_platform => \@by_platform,
        by_software => \@by_software,
        total       => $rs->count,
    };
};

1;
