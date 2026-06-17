package App::Crawler::Util::Web::Search;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::DBIC;
use App::Crawler::Util::Web 'sql_match';
use App::Crawler::Util::Port 'to_speed';
use Regexp::Common 'net';
use NetAddr::MAC ();
use NetAddr::IP::Lite ':lower';
use List::MoreUtils ();
use POSIX qw/strftime/;
use App::Crawler::Util::DNS 'ipv4_from_hostname';

use Exporter 'import';

our @EXPORT_OK = qw(search_devices search_nodes search_ports search_vlans);

# Each returns arrayref of results given a query string (+ optional params hash).

sub search_devices {
    my ($q, %p) = @_;

    my $tenant = $p{tenant};
    my $has_opt = List::MoreUtils::any { exists $p{$_} }
      qw/name location dns ip description model os os_ver vendor layers mac/;
    my $rs;
    my $rs_columns;
    my $see_all = $p{seeallcolumns};

    if ($see_all) {
      $rs_columns = schema($tenant)->resultset('Device');
    }
    else {
      $rs_columns = schema($tenant)->resultset('Device')->columns(
            [   "ip",       "dns",   "name",
                "location", "model", "os_ver", "serial", "chassis_id",
                "vendor",   "os",    "description", "contact"
            ]
        );
    }

    if ($has_opt) {
        $rs = $rs_columns->with_times->search_by_field( \%p );
    }
    else {
        return [] unless $q;
        $rs = $rs_columns->with_times->search_fuzzy($q);
    }

    my @results = $rs->with_module_serials # must come after search_fuzzy
                     ->hri->all;
    return [] unless scalar @results;

    # deduplicate the results as no longer distinct after with_module_serials
    my %seen = ();
    @results = grep { ! $seen{$_->{ip}}++ } @results;

    # flatten device serial, device chassis_id, and module serial(s), and deduplicate
    map {$_->{module_serials} = [ List::MoreUtils::uniq
                                  sort
                                  grep {length}
                                  grep {defined} (
                                    $_->{serial},
                                    $_->{chassis_id},
                                    ( map { $_->{serial} }
                                          @{ $_->{module_serials} } )
                                  )
                                ]} @results;

    return \@results;
}

sub search_nodes {
    my ($q, %p) = @_;

    return [] unless $q;
    return [] unless ($q =~ m/\w/); # need some alphanum at least

    my $tenant = $p{tenant};
    my $agenot = $p{age_invert} || '0';
    my ( $start, $end ) = ($p{daterange} || '') =~ m/(\d+-\d+-\d+)/gmx;

    my $mac = NetAddr::MAC->new(mac => ($q || ''));
    undef $mac if
      ($mac and $mac->as_ieee
      and (($mac->as_ieee eq '00:00:00:00:00:00')
        or ($mac->as_ieee !~ m/^$RE{net}{MAC}$/i)));

    my @active = ($p{archived} ? () : (-bool => 'active'));
    my (@times, @wifitimes, @porttimes);

    if ( $start and $end ) {
        $start = $start . ' 00:00:00';
        $end   = $end   . ' 23:59:59';

        if ($agenot) {
            @times = (-or => [
              time_first => [ undef ],
              time_last => [ { '<', $start }, { '>', $end } ]
            ]);
            @wifitimes = (-or => [
              time_last => [ undef ],
              time_last => [ { '<', $start }, { '>', $end } ],
            ]);
            @porttimes = (-or => [
              creation => [ undef ],
              creation => [ { '<', $start }, { '>', $end } ]
            ]);
        }
        else {
            @times = (-or => [
              -and => [
                  time_first => undef,
                  time_last  => undef,
              ],
              -and => [
                  time_last => { '>=', $start },
                  time_last => { '<=', $end },
              ],
            ]);
            @wifitimes = (-or => [
              time_last  => undef,
              -and => [
                  time_last => { '>=', $start },
                  time_last => { '<=', $end },
              ],
            ]);
            @porttimes = (-or => [
              creation => undef,
              -and => [
                  creation => { '>=', $start },
                  creation => { '<=', $end },
              ],
            ]);
        }
    }

    my ($likeval, $likeclause) = sql_match($q, not $p{partial});
    my $using_wildcards = (($likeval ne $q) ? 1 : 0);

    my @where_mac =
      ($using_wildcards ? \['me.mac::text ILIKE ?', $likeval]
                        : ((!defined $mac or $mac->errstr) ? \'0=1' : ('me.mac' => $mac->as_ieee)) );

    my $sightings = schema($tenant)->resultset('Node')
      ->search({-and => [@where_mac, @active, @times]}, {
          order_by => {'-desc' => 'time_last'},
          '+columns' => [
            'device.dns',
            'device.name',
            { time_first_stamp => \"to_char(time_first, 'YYYY-MM-DD HH24:MI')" },
            { time_last_stamp =>  \"to_char(time_last, 'YYYY-MM-DD HH24:MI')" },
          ],
          join => 'device',
      });

    my $ips = schema($tenant)->resultset('NodeIp')
      ->search({-and => [@where_mac, @active, @times]}, {
          order_by => {'-desc' => 'time_last'},
          '+columns' => [
            'manufacturer.company',
            'manufacturer.abbrev',
            { time_first_stamp => \"to_char(time_first, 'YYYY-MM-DD HH24:MI')" },
            { time_last_stamp =>  \"to_char(time_last, 'YYYY-MM-DD HH24:MI')" },
          ],
          join => 'manufacturer'
      })->with_router;

    my $netbios = schema($tenant)->resultset('NodeNbt')
      ->search({-and => [@where_mac, @active, @times]}, {
          order_by => {'-desc' => 'time_last'},
          '+columns' => [
            'manufacturer.company',
            'manufacturer.abbrev',
            { time_first_stamp => \"to_char(time_first, 'YYYY-MM-DD HH24:MI')" },
            { time_last_stamp =>  \"to_char(time_last, 'YYYY-MM-DD HH24:MI')" },
          ],
          join => 'manufacturer'
      });

    my $wireless = schema($tenant)->resultset('NodeWireless')->search(
        { -and => [@where_mac, @wifitimes] },
        { order_by   => { '-desc' => 'time_last' },
          '+columns' => [
            'manufacturer.company',
            'manufacturer.abbrev',
            {
              time_last_stamp => \"to_char(time_last, 'YYYY-MM-DD HH24:MI')"
            }],
          join => 'manufacturer'
        }
    );

    my $rs_dp = schema($tenant)->resultset('DevicePort');
    if ($sightings->has_rows or $ips->has_rows or $netbios->has_rows) {
        my $ports = $p{deviceports}
          ? $rs_dp->search({ -and => [@where_mac] }, { order_by => { '-desc' => 'creation' }}) : undef;

        return {
          ips       => [$ips->hri->all],
          sightings => [$sightings->hri->all],
          ports     => ($ports ? [$ports->hri->all] : []),
          wireless  => [$wireless->hri->all],
          netbios   => [$netbios->hri->all],
        };
    }
    else {
        my $ports = $p{deviceports}
          ? $rs_dp->search({ -and => [@where_mac, @porttimes] }, { order_by => { '-desc' => 'creation' }}) : undef;

        if (defined $ports and $ports->has_rows) {
            return {
              ips       => [$ips->hri->all],
              sightings => [$sightings->hri->all],
              ports     => [$ports->hri->all],
              wireless  => [$wireless->hri->all],
              netbios   => [$netbios->hri->all],
            };
        }
    }

    my $have_rows = 0;
    my $set = schema($tenant)->resultset('NodeNbt')
        ->search_by_name({nbname => $likeval, @active, @times});
    ++$have_rows if $set->has_rows;

    unless ( $have_rows ) {
        if ($q =~ m{^(?:$RE{net}{IPv4}|$RE{net}{IPv6})(?:/\d+)?$}i
            and my $ip = NetAddr::IP::Lite->new($q)) {

            # search_by_ip() will extract cidr notation if necessary
            $set = schema($tenant)->resultset('NodeIp')
              ->search_by_ip({ip => $ip, @active, @times})->with_router;
            ++$have_rows if $set->has_rows;
        }
        else {
            $set = schema($tenant)->resultset('NodeIp')
              ->search_by_dns({
                  ($using_wildcards ? (dns => $likeval) :
                                      (dns => "${likeval}.\%", suffix => ($p{domain_suffix} // setting('domain_suffix')))),
                  @active,
                  @times,
                })->with_router;
            ++$have_rows if $set->has_rows;

            # try DNS lookup as fallback
            if (not $using_wildcards and not $have_rows) {
                my $resolved_ip = ipv4_from_hostname($q);

                if ($resolved_ip) {
                    $set = schema($tenant)->resultset('NodeIp')
                      ->search_by_ip({ip => $resolved_ip, @active, @times})->with_router;
                    ++$have_rows if $set->has_rows;
                }
            }

            # if the user selects Vendor search opt, then
            # we'll try the manufacturer company name as a fallback

            if ($p{show_vendor} and not $have_rows) {
                $set = schema($tenant)->resultset('NodeIp')
                  ->with_times
                  ->search(
                    {'manufacturer.company' => { -ilike => ''.sql_match($q)}, @times},
                    {'prefetch' => 'manufacturer'},
                  )->with_router;
                ++$have_rows if $set->has_rows;
            }
        }
    }

    return [] unless $set and ($have_rows or $set->has_rows);
    $set = $set->search_rs({}, { order_by => 'me.mac' });

    return {
      macs => [$set->hri->all],
      archive_filter => {@active},
    };
}

sub search_ports {
    my ($q, %p) = @_;

    return [] unless $q;
    my $tenant = $p{tenant};
    my $rs;

    if ($q =~ m/^[0-9]+$/ and $q < 4096) {
        $rs = schema($tenant)->resultset('DevicePort')
                ->columns( [qw/ ip port name up up_admin speed /] )->search({
                  "port_vlans.vlan" => $q,
                  ( $p{uplink} ? () : (-or => [
                    {-not_bool => "properties.remote_is_discoverable"},
                    {-or => [
                      {-not_bool => "me.is_uplink"},
                      {"me.is_uplink" => undef},
                    ]}
                  ]) ),
                  ( $p{ethernet} ? ("me.type" => 'ethernetCsmacd') : () ),
                },{ '+columns' => [qw/ device.dns device.name port_vlans.vlan /],
                    join       => [qw/ properties port_vlans device /]
                }
                )->with_times;
    }
    else {
        my ( $likeval, $likeclause ) = sql_match($q);
        my $mac = NetAddr::MAC->new(mac => ($q || ''));

        undef $mac if
          ($mac and $mac->as_ieee
          and (($mac->as_ieee eq '00:00:00:00:00:00')
            or ($mac->as_ieee !~ m/^$RE{net}{MAC}$/i)));

        $rs = schema($tenant)->resultset('DevicePort')
                                ->columns( [qw/ ip port name up up_admin speed properties.remote_dns /] )
                                ->search({
              -and => [
                -or => [
                  { "me.name" => ( $p{partial} ? $likeclause : $q ) },
                  ( $p{descr} ? (
                    { "me.descr" => ( $p{partial} ? $likeclause : $q ) },
                  ) : () ),
                  ( ((!defined $mac) or $mac->errstr)
                      ? \[ 'me.mac::text ILIKE ?', $likeval ]
                      : {  'me.mac' => $mac->as_ieee        }
                  ),
                  { "properties.remote_dns" => $likeclause },
                  ( $p{uplink} ? (
                    { "me.remote_id"   => $likeclause },
                    { "me.remote_type" => $likeclause },
                  ) : () ),
                ],
                ( $p{uplink} ? () : (-or => [
                  { "properties.remote_dns" => $likeclause },
                  {-not_bool => "properties.remote_is_discoverable"},
                  {-or => [
                    {-not_bool => "me.is_uplink"},
                    {"me.is_uplink" => undef},
                  ]}
                ]) ),
                ( $p{ethernet} ? ("me.type" => 'ethernetCsmacd') : () ),
              ]
            },
            {   '+columns' => [qw/ device.dns device.name /, {vlan_agg => q{array_to_string(array_agg(port_vlans.vlan), ', ')}} ],
                join       => [qw/ properties port_vlans device /],
                group_by => [qw/me.ip me.port me.name me.up me.up_admin me.speed device.dns device.name device.last_discover device.uptime properties.remote_dns/],
            }
            )->with_times;
    }

    my @results = $rs->hri->all;
    return [] unless scalar @results;
    map { $_->{speed} = to_speed( $_->{speed} ) } @results;

    return \@results;
}

sub search_vlans {
    my ($q, %p) = @_;

    return [] unless $q;
    return [] unless ($q =~ m/\w/); # need some alphanum at least

    my $tenant = $p{tenant};
    my $rs;

    if ( $q =~ m/^\d+$/ ) {
        $rs = schema($tenant)->resultset('Device')
            ->carrying_vlan( { vlan => $q } );
    }
    else {
        $rs = schema($tenant)->resultset('Device')
            ->carrying_vlan_name( { name => $q } );
    }

    my @results = $rs->hri->all;
    return [] unless scalar @results;

    return \@results;
}

1;
