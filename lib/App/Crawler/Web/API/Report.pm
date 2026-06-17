package App::Crawler::Web::API::Report;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use App::Crawler::Web::API::ReportAdapters;

# Per-tag bind defaults for Virtual::* resultsets that require bind params.
# Keys are lowercased report tags. Values are arrayrefs of safe defaults that
# match the resultset's view definition signature.
my %BIND_DEFAULTS = (
    # PortVLANMismatch view filters by 4 reserved-VLAN IDs (1002..1005 by default).
    portvlanmismatch => [1002, 1003, 1004, 1005],
    # PortUtilization: 3 interval placeholders for "mark free if down for X"
    # (matches UI plugin default: 3 months)
    portutilization  => ['3 months', '3 months', '3 months'],
    # DeviceDnsMismatch: 2 domain suffix placeholders for DNS/name comparison
    # Empty string = no domain stripping (matches UI plugin behavior when domain_suffix not set)
    devicednsmismatch => ['', ''],
);

my %ADAPTERS = (
    deviceaddrnodns      => \&App::Crawler::Web::API::ReportAdapters::run_deviceaddrnodns,
    devicebylocation     => \&App::Crawler::Web::API::ReportAdapters::run_devicebylocation,
    inventorybymodelbyos => \&App::Crawler::Web::API::ReportAdapters::run_inventorybymodelbyos,
    moduleinventory      => \&App::Crawler::Web::API::ReportAdapters::run_moduleinventory,
    netbios              => \&App::Crawler::Web::API::ReportAdapters::run_netbios,
    halfduplex           => \&App::Crawler::Web::API::ReportAdapters::run_halfduplex,
    portadmindown        => \&App::Crawler::Web::API::ReportAdapters::run_portadmindown,
    portblocking         => \&App::Crawler::Web::API::ReportAdapters::run_portblocking,
    portmultinodes       => \&App::Crawler::Web::API::ReportAdapters::run_portmultinodes,
    portssid             => \&App::Crawler::Web::API::ReportAdapters::run_portssid,
    nodemultiips         => \&App::Crawler::Web::API::ReportAdapters::run_nodemultiips,
    nodevendor           => \&App::Crawler::Web::API::ReportAdapters::run_nodevendor,
    apchanneldist        => \&App::Crawler::Web::API::ReportAdapters::run_apchanneldist,
    apclients            => \&App::Crawler::Web::API::ReportAdapters::run_apclients,
    ssidinventory        => \&App::Crawler::Web::API::ReportAdapters::run_ssidinventory,
    ipinventory          => \&App::Crawler::Web::API::ReportAdapters::run_ipinventory,
    portlog              => \&App::Crawler::Web::API::ReportAdapters::run_portlog,
    subnets              => \&App::Crawler::Web::API::ReportAdapters::run_subnets,
    vlaninventory        => \&App::Crawler::Web::API::ReportAdapters::run_vlaninventory,
    vlanmultiplenames    => \&App::Crawler::Web::API::ReportAdapters::run_vlanmultiplenames,
);

# Self-contained report registry. The legacy Plugin/Report/*.pm files used to
# register themselves into setting('_reports') at load time; we deleted those
# in SP7-M3. This hardcoded map replaces them — it's the single source of
# truth for what reports exist, what category they belong to, and what their
# human-readable label is.
my %REPORT_REGISTRY = (
    # Device
    devicebylocation     => { category => 'Device', label => 'By Location' },
    inventorybymodelbyos => { category => 'Device', label => 'By Vendor/Model/OS' },
    deviceaddrnodns      => { category => 'Device', label => 'IPs without DNS' },
    devicednsmismatch    => { category => 'Device', label => 'DNS Mismatch' },
    devicepoestatus      => { category => 'Device', label => 'PoE Status' },
    moduleinventory      => { category => 'Device', label => 'Module Inventory' },
    # IP
    ipinventory          => { category => 'IP', label => 'IP Inventory' },
    subnets              => { category => 'IP', label => 'Subnet Utilization' },
    # Node
    nodevendor           => { category => 'Node', label => 'By Vendor (OUI)' },
    nodemultiips         => { category => 'Node', label => 'Multi-IP Nodes' },
    netbios              => { category => 'Node', label => 'NetBIOS' },
    nodesdiscovered      => { category => 'Node', label => 'Discovered via LLDP/CDP' },
    # Port
    portadmindown        => { category => 'Port', label => 'Admin Down' },
    portblocking         => { category => 'Port', label => 'Blocking (STP)' },
    portlog              => { category => 'Port', label => 'Port Log' },
    portmultinodes       => { category => 'Port', label => 'Multi-Node Ports' },
    portssid             => { category => 'Port', label => 'SSIDs on Ports' },
    portutilization      => { category => 'Port', label => 'Utilization' },
    portvlanmismatch     => { category => 'Port', label => 'VLAN Mismatch' },
    halfduplex           => { category => 'Port', label => 'Half Duplex' },
    duplexmismatch       => { category => 'Port', label => 'Duplex Mismatch' },
    # VLAN
    vlaninventory        => { category => 'VLAN', label => 'VLAN Inventory' },
    vlanmultiplenames    => { category => 'VLAN', label => 'Multiple Names' },
    # Wireless
    apchanneldist        => { category => 'Wireless', label => 'Channel Distribution' },
    apclients            => { category => 'Wireless', label => 'AP Clients' },
    apradiochannelpower  => { category => 'Wireless', label => 'Radio Channel Power' },
    ssidinventory        => { category => 'Wireless', label => 'SSID Inventory' },
);

sub _list_reports {
    my @list;
    for my $tag (sort keys %REPORT_REGISTRY) {
        my $entry = $REPORT_REGISTRY{$tag};
        push @list, {
            tag           => $tag,
            category      => $entry->{category},
            label         => $entry->{label},
            provides_csv  => 1,
            api_endpoint  => 1,
            supported     => 1,
        };
    }
    return \@list;
}

sub _resolve_resultset {
    my ($tag) = @_;
    return (undef, "unknown report tag '$tag'")
        unless $REPORT_REGISTRY{$tag} || $ADAPTERS{lc $tag};

    my @sources = schema('netdisco')->sources;
    my ($match) = grep {
        my $simple = $_;
        $simple =~ s/^.*:://;
        lc($simple) eq lc($tag);
    } @sources;

    return (undef, "no Virtual::* resultset found for tag '$tag'")
        unless $match;

    my $rs = eval { schema('netdisco')->resultset($match) };
    return (undef, "resultset '$match' load failed: $@") if $@ || !$rs;
    return ($rs, undef);
}

sub _run_report {
    my ($tag) = @_;

    if (my $fn = $ADAPTERS{ lc $tag }) {
        my $rows = eval { $fn->({ %{ params() } }) };
        if ($@) {
            my $msg = $@;
            $msg =~ s/^DBIx::Class::Storage::DBI::_dbh_execute\(\): //;
            status 500;
            halt to_json { error => "adapter '$tag' failed: $msg" };
        }
        return $rows;
    }

    my ($rs, $err) = _resolve_resultset($tag);
    if ($err) {
        status 404;
        halt to_json { error => $err };
    }
    my $bind = $BIND_DEFAULTS{ lc $tag };
    my @rows = eval {
        $bind ? $rs->search({}, { bind => $bind })->hri->all
              : $rs->hri->all;
    };
    if ($@) {
        my $msg = $@;
        $msg =~ s/^DBIx::Class::Storage::DBI::_dbh_execute\(\): //;
        status 500;
        halt to_json {
            error      => "report query failed: $msg",
            suggestion => "this report likely needs bind parameters or a custom handler not yet wired into the unified /api surface",
        };
    }
    return \@rows;
}

swagger_path {
    description => 'List all registered reports',
    tags        => ['report'],
    responses   => { default => {} },
},
get '/api/report' => require_role api => sub {
    content_type 'application/json';
    return to_json { reports => _list_reports() };
};

get '/api/report/:category/:tag.csv' => require_role api => sub {
    content_type 'text/csv';
    my $tag = param('tag');
    $tag =~ s/\.csv$//;  # Strip .csv suffix if Dancer didn't parse it out
    my $rows = _run_report($tag);
    return '' unless @$rows;
    my @cols = sort keys %{ $rows->[0] };
    my $out  = join(',', @cols) . "\n";
    for my $r (@$rows) {
        $out .= join(',', map {
            my $v = $_;
            if (!defined $v) { '' }
            else { $v =~ s/"/""/g; qq{"$v"} }
        } @{$r}{@cols}) . "\n";
    }
    return $out;
};

swagger_path {
    description => 'Run a report, returns JSON rows',
    tags        => ['report'],
    parameters  => [
        { name => 'category', in => 'path', type => 'string', required => 1 },
        { name => 'tag',      in => 'path', type => 'string', required => 1 },
    ],
    responses   => { default => {} },
},
get '/api/report/:category/:tag' => require_role api => sub {
    content_type 'application/json';
    my $rows = _run_report(param('tag'));
    return to_json { rows => $rows };
};

1;
