package App::Crawler::Web::API::Search;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use App::Crawler::Util::Web::Search qw(
    search_devices search_nodes search_ports search_vlans
);
use List::Util ();

my %dispatch = (
    device => \&search_devices,
    node   => \&search_nodes,
    port   => \&search_ports,
    vlan   => \&search_vlans,
);

# Tag each device match with the first field whose value contained the query.
# Lets the SPA show "matched on serial: BCBA9109" instead of a bare device name.
sub _annotate_device_matches {
    my ($q, $rows) = @_;
    return unless $q && ref $rows eq 'ARRAY' && @$rows;
    my $needle = lc $q;

    for my $r (@$rows) {
        my @cand = map { [$_->[0], $r->{$_->[1] // $_->[0]}] }
            ([qw/ip ip/],           [qw/name name/],        [qw/dns dns/],
             [qw/serial serial/],   [qw/chassis_id chassis_id/],
             [qw/model model/],     [qw/vendor vendor/],
             [qw/os os/],           [qw/os_ver os_ver/],
             [qw/location location/],
             [qw/contact contact/], [qw/description description/]);
        if (ref $r->{module_serials} eq 'ARRAY') {
            push @cand, map { ['module_serial', $_] } @{ $r->{module_serials} };
        }
        for my $c (@cand) {
            next unless defined $c->[1] && length $c->[1];
            next unless index(lc $c->[1], $needle) >= 0;
            $r->{_match} = { field => $c->[0], value => "$c->[1]" };
            last;
        }
    }

    # Any row that didn't match on a top-level column / chassis-serial probably
    # matched via the modules.serial subquery in search_fuzzy. Look up the
    # specific module serial so the SPA can show what hit (e.g. "S/N BCBA9109").
    my @unannotated = grep { !$_->{_match} } @$rows;
    if (@unannotated) {
        my @ips = List::Util::uniq map { $_->{ip} } @unannotated;
        my $modrs = schema('netdisco')->resultset('DeviceModule')->search(
            { ip => { -in => \@ips },
              serial => { -ilike => "\%$q\%" } },
            { columns => [qw/ ip serial /], order_by => 'index' },
        );
        my %first;
        while (my $m = $modrs->next) {
            $first{ $m->ip } //= $m->serial;
        }
        for my $r (@unannotated) {
            next unless $first{ $r->{ip} };
            $r->{_match} = { field => 'module_serial', value => $first{ $r->{ip} } };
        }
    }
}

swagger_path {
    description => 'Unified search across devices, nodes, ports, vlans',
    tags        => ['search'],
    parameters  => [
        { name => 'q',    in => 'query', type => 'string', required => 1 },
        { name => 'type', in => 'query', type => 'string',
          enum => [qw(device node port vlan)], required => 1 },
    ],
    responses   => { default => {} },
},
get '/api/search' => require_role api => sub {
    content_type 'application/json';
    my $q    = param('q')    // '';
    my $type = param('type') // '';
    my $fn   = $dispatch{$type}
        or do { status 400; return to_json { error => 'unknown type' } };

    my %params = %{ scalar params };
    $params{tenant} = vars->{'tenant'};

    my $matches = $fn->($q, %params);
    _annotate_device_matches($q, $matches) if $type eq 'device';
    return to_json { matches => $matches };
};

1;
