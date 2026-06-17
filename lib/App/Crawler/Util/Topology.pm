package App::Crawler::Util::Topology;

use strict;
use warnings;

use base 'Exporter';
our @EXPORT_OK = qw/neighbors_of/;

=head1 NAME

App::Crawler::Util::Topology - layer-2 adjacency derived from discovered data

=head1 DESCRIPTION

Single source of truth for "who is connected to this device". Adjacency comes
from two places, unioned:

=over

=item * C<device_port> LLDP/CDP columns (C<remote_ip>/C<remote_port>/
C<remote_id>/C<remote_type>) — populated by discover. This is the primary
source and is present even when the C<topology> table is empty.

=item * the C<topology> table (manual or topology-resolved links), both
directions.

=back

Each neighbor is enriched with the discovered C<device> row when known, or with
LLDP-reported attributes from C<device_port_properties> when the neighbor is not
(yet) a discovered device — so the map can still label it.

=head1 FUNCTIONS

=head2 neighbors_of($schema, $ip)

Returns an arrayref of neighbor hashes:

  { ip, dns, name, vendor, model, os, layers, discovered (bool),
    links => [ { local_port, remote_port, remote_id, type } ] }

=cut

sub neighbors_of {
  my ($schema, $ip) = @_;
  return [] unless $schema && defined $ip;

  my %nb;  # remote_ip => neighbor hash

  my $add_link = sub {
    my ($rip, $link) = @_;
    return unless defined $rip && length $rip;
    my $n = $nb{$rip} ||= { ip => $rip, links => [] };
    # de-dupe on (local_port, remote_port)
    return if grep {
      ($_->{local_port}  // '') eq ($link->{local_port}  // '') &&
      ($_->{remote_port} // '') eq ($link->{remote_port} // '')
    } @{ $n->{links} };
    push @{ $n->{links} }, $link;
  };

  # 1. LLDP/CDP neighbors recorded on this device's ports
  my $ports = $schema->resultset('DevicePort')->search(
    { ip => $ip, remote_ip => { '!=', undef } },
    { columns => [qw/port remote_ip remote_port remote_id remote_type/] },
  );
  while (my $p = $ports->next) {
    $add_link->( "".$p->remote_ip, {
      local_port  => $p->port,
      remote_port => $p->remote_port,
      remote_id   => $p->remote_id,
      type        => $p->remote_type,
    });
  }

  # 2. topology table links (both directions)
  my $topo = $schema->resultset('Topology')
    ->search({ -or => [ { dev1 => $ip }, { dev2 => $ip } ] });
  while (my $t = $topo->next) {
    my ($rip, $lport, $rport) = ("".$t->dev1 eq "$ip")
      ? ("".$t->dev2, $t->port1, $t->port2)
      : ("".$t->dev1, $t->port2, $t->port1);
    $add_link->( $rip, {
      local_port => $lport, remote_port => $rport,
      remote_id => undef, type => 'topology',
    });
  }

  return [] unless %nb;

  # LLDP-reported attributes for this device's ports, keyed by local port —
  # used to label neighbors that aren't discovered devices.
  my %prop_by_port;
  my $props = $schema->resultset('DevicePortProperties')->search(
    { ip => $ip },
    { columns => [qw/port remote_vendor remote_model remote_os_ver remote_serial remote_dns/] },
  );
  # 'port' is also a belongs_to relationship name here, so use get_column.
  while (my $r = $props->next) { $prop_by_port{ $r->get_column('port') } = { $r->get_columns } }

  for my $rip (keys %nb) {
    my $n = $nb{$rip};
    if (my $dev = $schema->resultset('Device')->find($rip)) {
      $n->{dns}        = $dev->dns;
      $n->{name}       = $dev->name;
      $n->{vendor}     = $dev->vendor;
      $n->{model}      = $dev->model;
      $n->{os}         = $dev->os;
      $n->{layers}     = $dev->layers;
      $n->{discovered} = \1;
    }
    else {
      $n->{discovered} = \0;
      # fall back to LLDP-reported attrs from any link's local port
      for my $link (@{ $n->{links} }) {
        my $pp = $prop_by_port{ $link->{local_port} // '' } or next;
        $n->{vendor} ||= $pp->{remote_vendor};
        $n->{model}  ||= $pp->{remote_model};
        $n->{os}     ||= $pp->{remote_os_ver};
        $n->{dns}    ||= $pp->{remote_dns};
        $n->{serial} ||= $pp->{remote_serial};
      }
    }
  }

  return [ map { $nb{$_} } sort keys %nb ];
}

1;
