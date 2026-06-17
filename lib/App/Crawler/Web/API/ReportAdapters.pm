package App::Crawler::Web::API::ReportAdapters;

use strict;
use warnings;

use Dancer::Plugin::DBIC;
use Exporter 'import';

our @EXPORT_OK;  # populated as adapters land in subsequent tasks

# Each adapter: sub run_<tag> { my ($params) = @_; ... ; return \@rows }
# - $params is a hashref of query-string params (always present, may be empty)
# - returns arrayref of hashrefs ready for JSON serialization

sub run_deviceaddrnodns {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('Device')->search(
        { 'device_ips.dns' => undef },
        {
            select   => [ 'ip', 'dns', 'name', 'location', 'contact' ],
            join     => [qw/device_ips/],
            '+columns' => [ { 'alias' => 'device_ips.alias' } ],
            order_by => { -asc => [qw/me.ip device_ips.alias/] },
        }
    )->hri->all;
    return \@rows;
}

sub run_devicebylocation {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('Device')->search(
        {},
        {
            select   => ['location', { count => 'ip', -as => 'count' }],
            as       => [qw/ location count /],
            group_by => ['location'],
            order_by => { -desc => 'count' },
        },
    )->hri->all;
    for my $r (@rows) {
        $r->{location} = '(no location)' unless defined $r->{location} && length $r->{location};
    }
    return \@rows;
}

sub run_inventorybymodelbyos {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('Device')->search(undef, {
        columns  => [qw/vendor model os os_ver/],
        select   => [ { count => \'*' } ],
        as       => [qw/ os_ver_count /],
        group_by => [qw/ vendor model os os_ver /],
        order_by => ['vendor', 'model', { -desc => 'count' }, 'os_ver'],
    })->hri->all;
    return \@rows;
}

sub run_moduleinventory {
    my ($params) = @_;
    # Default behavior: group by class (no filters applied)
    my @rows = schema('netdisco')->resultset('DeviceModule')->search(
        { class => { '!=', undef } },
        {
            select   => [ 'class', { count => 'class' } ],
            as       => [qw/ class count /],
            group_by => [qw/ class /]
        }
    )->order_by( { -desc => 'count' } )->hri->all;
    return \@rows;
}

sub run_netbios {
    my ($params) = @_;
    # Default behavior: group by domain (no filters applied)
    my @rows = schema('netdisco')->resultset('NodeNbt')->search(
        {},
        {
            select   => [ 'domain', { count => 'domain' } ],
            as       => [qw/ domain count /],
            group_by => [qw/ domain /]
        }
    )->order_by( { -desc => 'count' } )->hri->all;
    return \@rows;
}

sub run_halfduplex {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('DevicePort')
        ->columns( [qw/ ip port name duplex /] )->search(
        { up => 'up', duplex => { '-ilike' => 'half' } },
        {   '+columns' => [qw/ device.dns device.name /],
            join       => [qw/ device /],
            collapse   => 1,
        }
        )->order_by( [qw/ device.dns port /] )->hri->all;
    return \@rows;
}

sub run_portadmindown {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('Device')->search(
        { 'up_admin' => 'down' },
        {   select     => [ 'ip', 'dns', 'name' ],
            join       => [ 'ports' ],
            '+columns' => [
                { 'port'        => 'ports.port' },
                { 'description' => 'ports.name' },
                { 'up_admin'    => 'ports.up_admin' },
            ]
        }
    )->hri->all;
    return \@rows;
}

sub run_portblocking {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('Device')->search(
        { 'stp' => [ 'blocking', 'broken' ], 'up' => { '!=', 'down' } },
        {   select     => [ 'ip', 'dns', 'name' ],
            join       => ['ports'],
            '+columns' => [
                { 'port'        => 'ports.port' },
                { 'description' => 'ports.name' },
                { 'stp'         => 'ports.stp' },
            ]
        }
    )->hri->all;
    return \@rows;
}

sub run_portmultinodes {
    my ($params) = @_;
    my $vlan = $params->{vlan};
    my @rows = schema('netdisco')->resultset('Device')->search(
        {   'ports.remote_ip' => undef,
            ($vlan ?
              ('ports.vlan' => $vlan, 'nodes.vlan' => $vlan) : ()),
            'nodes.active'    => 1,
            'wireless.port'   => undef
        },
        {   select => [ 'ip', 'dns', 'name' ],
            join       => { 'ports' => [ 'wireless', 'nodes' ] },
            '+columns' => [
                { 'port'        => 'ports.port' },
                { 'description' => 'ports.name' },
                { 'mac_count'   => { count => 'nodes.mac' } },
            ],
            group_by => [qw/me.ip me.dns me.name ports.port ports.name/],
            having   => \[ 'count(nodes.mac) > ?', [ count => 1 ] ],
            order_by => { -desc => [qw/count/] },
        }
    )->hri->all;
    return \@rows;
}

sub run_portssid {
    my ($params) = @_;
    my $ssid = $params->{ssid};
    my $rs = schema('netdisco')->resultset('DevicePortSsid');

    if ( defined $ssid ) {
        $rs = $rs->search(
            { ssid => $ssid },
            {   '+columns' => [
                    qw/ device.dns device.name device.model device.vendor port.port/
                ],
                join     => [qw/ device port /],
                collapse => 1,
            }
        )->order_by( [qw/ port.ip port.port /] )->hri;
    }
    else {
        $rs = $rs->get_ssids->hri;
    }

    my @rows = $rs->all;
    return \@rows;
}

sub run_nodemultiips {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('Node')->search(
        {},
        {   select     => [ 'mac', 'switch', 'port' ],
            join       => [qw/device ips manufacturer/],
            '+columns' => [
                { 'dns'      => 'device.dns' },
                { 'name'     => 'device.name' },
                { 'ip_count' => { count => 'ips.ip' } },
                { 'vendor'   => 'manufacturer.company' }
            ],
            group_by => [
                qw/ me.mac me.switch me.port device.dns device.name manufacturer.company/
            ],
            having => \[ 'count(ips.ip) > ?', [ count => 1 ] ],
            order_by => { -desc => [qw/count/] },
        }
    )->hri->all;
    return \@rows;
}

sub run_nodevendor {
    my ($params) = @_;
    my $vendor = $params->{vendor};
    my $rs = schema('netdisco')->resultset('Node');
    my @rows;

    if ( defined $vendor ) {
        my $match = $vendor eq 'blank' ? undef : $vendor;
        $rs = $rs->search( { 'manufacturer.abbrev' => $match },
            {   '+columns' => [qw/ device.dns device.name manufacturer.abbrev manufacturer.company /],
                join       => [qw/ manufacturer device /],
                collapse   => 1,
            });
        $rs = $rs->search( { -bool => 'me.active' } );
        @rows = $rs->hri->all;
    }
    else {
        $rs = $rs->search(
            { },
            {   join     => 'manufacturer',
                select   => [ 'manufacturer.abbrev', 'manufacturer.company', { count => {distinct => 'me.mac'}} ],
                as       => [qw/ abbrev vendor count /],
                group_by => [qw/ manufacturer.abbrev manufacturer.company /]
            }
        )->order_by( { -desc => 'count' } );
        $rs = $rs->search( { -bool => 'me.active' } );
        @rows = $rs->hri->all;
    }

    return \@rows;
}

sub run_apchanneldist {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('DevicePortWireless')->search(
        { channel => { '!=', '0' } },
        {   select   => [ 'channel', { count => 'channel' } ],
            as       => [qw/ channel ch_count /],
            group_by => [qw/channel/],
            order_by => { -desc => [qw/count/] },
        },
    )->hri->all;
    return \@rows;
}

sub run_apclients {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('Device')->search(
        { 'nodes.time_last' => { '>=', \'me.last_macsuck' },
          'ports.port' => { '-in' => schema('netdisco')->resultset('DevicePortWireless')->get_column('port')->as_query },
        },
        {   select => [ 'ip', 'model', 'ports.port', 'ports.name', 'ports.type' ],
            join       => { 'ports' =>  'nodes' },
            '+columns' => [
                { 'mac_count' => { count => 'nodes.mac' } },
            ],
            group_by => [
                'me.ip', 'me.model', 'ports.port', 'ports.name', 'ports.type',
            ],
            order_by => { -asc => [qw/ports.name ports.type/] },
        }
    )->hri->all;
    return \@rows;
}

sub run_ssidinventory {
    my ($params) = @_;
    my @rows = schema('netdisco')->resultset('DevicePortSsid')
        ->get_ssids->hri->all;
    return \@rows;
}

sub run_ipinventory {
    my ($params) = @_;
    # The real plugin uses a complex union query with subnet filters, date ranges, and "never seen" support.
    # For API usage, we provide a simplified version that supports subnet filtering.
    my %where;
    if (my $subnet = $params->{subnet}) {
        $where{-or} = [
            { 'me.ip::text' => { -like => "$subnet%" } },
        ];
    }
    my @rows = schema('netdisco')->resultset('DeviceIp')->search(
        \%where,
        { order_by => [qw/me.ip/], prefetch => 'device', rows => 10000 },
    )->hri->all;
    return \@rows;
}

sub run_portlog {
    my ($params) = @_;
    # The real plugin serves port-specific logs for a device+port combo.
    # For API usage, we return recent log entries across all ports.
    my $limit = int($params->{limit} // 500);
    my @rows = schema('netdisco')->resultset('DevicePortLog')->search(
        {},
        { order_by => { -desc => 'creation' }, rows => $limit },
    )->hri->all;
    return \@rows;
}

sub run_subnets {
    my ($params) = @_;
    # The real plugin uses Virtual::SubnetUtilization with bind params.
    # For now, we return basic subnet records from the Subnet table.
    my @rows = schema('netdisco')->resultset('Subnet')->search(
        {},
        { order_by => 'net' },
    )->hri->all;
    return \@rows;
}

sub run_vlaninventory {
    my ($params) = @_;
    # Extracted from VlanInventory.pm
    my @rows = schema('netdisco')->resultset('DeviceVlan')->search(
        { 'me.description' => { '!=', 'NULL' },
          'me.vlan' => { '>' => 0 },
          'ports.vlan' => { '>' => 0 },
        },
        {   join   => { 'ports' => 'vlan_entry' },
            select => [
                'me.vlan',
                'me.description',
                { count => { distinct => 'me.ip' } },
                { count => 'ports.vlan' }
            ],
            as       => [qw/ vlan description dcount pcount /],
            group_by => [qw/ me.vlan me.description /],
        }
    )->hri->all;
    return \@rows;
}

sub run_vlanmultiplenames {
    my ($params) = @_;
    # Extracted from VlanInventory.pm (second report in same file)
    my @rows = schema('netdisco')->resultset('DeviceVlan')->search(
        { 'me.description' => { '!=', 'NULL' },
          'me.vlan' => { '>' => 0 },
          'ports.vlan' => { '>' => 0 },
        },
        {   join   => { 'ports' => 'vlan_entry' },
            select => [
                'me.vlan',
                { count => { distinct => 'me.ip' } },
                { count => 'ports.vlan' },
                \q{ array_agg(DISTINCT me.description ORDER BY me.description) },
            ],
            as       => [qw/ vlan dcount pcount description /],
            group_by => [qw/ me.vlan /],
            having   => \q{ count (DISTINCT me.description) > 1 },
        }
    )->hri->all;
    return \@rows;
}

1;
