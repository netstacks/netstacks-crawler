package App::Crawler::Web::API::Objects;

use Dancer ':syntax';
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Swagger;
use Dancer::Plugin::Auth::Extensible;

use App::Crawler::JobQueue 'jq_insert';
use App::Crawler::Util::Topology 'neighbors_of';
use Try::Tiny;

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/device/{ip}',
  description => 'Returns a row from the device table',
  parameters  => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
  ],
  responses => { default => {} },
}, get '/api/object/device/:ip' => require_role api => sub {
  my $device = try { schema(vars->{'tenant'})->resultset('Device')
    ->find( params->{ip} ) } or send_error('Bad Device', 404);

  my $data = $device->TO_JSON;

  my @modules = try {
    schema(vars->{'tenant'})->resultset('DevicePower')
      ->search({ 'me.ip' => $device->ip })->with_poestats->hri->all;
  } catch { () };

  if (@modules) {
    my %totals = (
      modules             => scalar @modules,
      power_total         => 0,
      poe_capable_ports   => 0,
      poe_powered_ports   => 0,
      poe_disabled_ports  => 0,
      poe_errored_ports   => 0,
      poe_power_committed => 0,
      poe_power_delivering => 0,
    );
    for my $m (@modules) {
      $totals{power_total}          += $m->{power}               // 0;
      $totals{poe_capable_ports}    += $m->{poe_capable_ports}   // 0;
      $totals{poe_powered_ports}    += $m->{poe_powered_ports}   // 0;
      $totals{poe_disabled_ports}   += $m->{poe_disabled_ports}  // 0;
      $totals{poe_errored_ports}    += $m->{poe_errored_ports}   // 0;
      $totals{poe_power_committed}  += $m->{poe_power_committed} // 0;
      $totals{poe_power_delivering} += $m->{poe_power_delivering} // 0;
    }
    $data->{poe} = \%totals;
  } else {
    $data->{poe} = undef;
  }

  return to_json $data;
};

foreach my $rel (qw/device_ips vlans ports modules port_vlans wireless_ports ssids powered_ports/) {
    swagger_path {
      tags => ['Objects'],
      path => (setting('api_base') || '')."/object/device/{ip}/$rel",
      description => "Returns $rel rows for a given device",
      parameters  => [
        ip => {
          description => 'Canonical IP of the Device. Use Search methods to find this.',
          required => 1,
          in => 'path',
        },
      ],
      responses => { default => {} },
    }, get "/api/object/device/:ip/$rel" => require_role api => sub {
      my $rows = try { schema(vars->{'tenant'})->resultset('Device')
        ->find( params->{ip} )->$rel } or send_error('Bad Device', 404);
      return to_json [ map {$_->TO_JSON} $rows->all ];
    };
}

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/device/{ip}/power_modules',
  description => 'Returns PoE module status and aggregated port statistics for a given device',
  parameters  => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
  ],
  responses => { default => {} },
}, get '/api/object/device/:ip/power_modules' => require_role api => sub {
  my $device = try { schema(vars->{'tenant'})->resultset('Device')
    ->find( params->{ip} ) } or send_error('Bad Device', 404);
  my @rows = try {
    schema(vars->{'tenant'})->resultset('DevicePower')
      ->search({ 'me.ip' => $device->ip })->with_poestats->hri->all;
  } catch { () };
  return to_json \@rows;
};

swagger_path {
  tags => ['Objects'],
  path => setting('api_base')."/object/device/{ip}/neighbors",
  description => 'Returns layer 2 neighbor relation data for a given device',
  parameters => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
    scope => {
      description => 'Scope of results, either "all", "cloud" (LLDP cloud), or "depth" (uses hops)',
      default => 'depth',
      in => 'query',
    },
    hops => {
      description => 'When specifying Scope "depth", this is the number of hops',
      default => '1',
      in => 'query',
    },
    vlan => {
      description => 'Limit results to devices carrying this numeric VLAN ID',
    },
  ],
  responses => { default => {} },
}, get "/api/object/device/:ip/neighbors" => require_role api => sub {
  my $schema = schema(vars->{'tenant'});
  my $device = try { $schema->resultset('Device')->find( params->{ip} ) }
    or send_error('Bad Device', 404);

  my $neighbors = neighbors_of($schema, "".$device->ip);

  if (my $vlan = params->{'vlan'}) {
    # Limit to neighbors reachable over a port carrying this VLAN.
    my %on_vlan = map { ("".$_->ip . '|' . $_->port) => 1 }
      $schema->resultset('DevicePortVlan')
        ->search({ ip => $device->ip, vlan => $vlan })->all;
    $neighbors = [ grep {
      my $n = $_;
      grep { $on_vlan{ "".$device->ip . '|' . ($_->{local_port} // '') } } @{ $n->{links} }
    } @$neighbors ];
  }

  return to_json {
    device    => $device->TO_JSON,
    neighbors => $neighbors,
  };
};

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/device/{ip}/jobs',
  description => 'Delete jobs and clear skiplist for a device, optionally filtered by fields',
  parameters  => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
    port => {
      description => 'Port field of the Job',
    },
    action => {
      description => 'Action field of the Job',
    },
    status => {
      description => 'Status field of the Job',
    },
    username => {
      description => 'Username of the Job submitter',
    },
    userip => {
      description => 'IP address of the Job submitter',
    },
    backend => {
      description => 'Backend instance assigned the Job',
    },
  ],
  responses => { default => {} },
}, del '/api/object/device/:ip/jobs' => require_role api_admin => sub {
  my $device = try { schema(vars->{'tenant'})->resultset('Device')
    ->find( params->{ip} ) } or send_error('Bad Device', 404);

  my $gone = schema(vars->{'tenant'})->resultset('Admin')->search({
    device => param('ip'),
    ( param('port')     ? ( port     => param('port') )     : () ),
    ( param('action')   ? ( action   => param('action') )   : () ),
    ( param('status')   ? ( status   => param('status') )   : () ),
    ( param('username') ? ( username => param('username') ) : () ),
    ( param('userip')   ? ( userip   => param('userip') )   : () ),
    ( param('backend')  ? ( backend  => param('backend') )  : () ),
  })->delete;

  schema(vars->{'tenant'})->resultset('DeviceSkip')->search({
    device => param('ip'),
    ( param('action')  ? ( actionset => { '&&' => \[ 'ARRAY[?]', param('action') ] } ) : () ),
    ( param('backend') ? ( backend   => param('backend') ) : () ),
  })->delete;

  return to_json { deleted => ($gone || 0)};
};

foreach my $rel (qw/nodes active_nodes nodes_with_age active_nodes_with_age port_vlans vlans logs/) {
    swagger_path {
      tags => ['Objects'],
      description => "Returns $rel rows for a given port",
      path => (setting('api_base') || '')."/object/device/{ip}/port/{port}/$rel",
      parameters  => [
        ip => {
          description => 'Canonical IP of the Device. Use Search methods to find this.',
          required => 1,
          in => 'path',
        },
        port => {
          description => 'Name of the port. Use the ".../device/{ip}/ports" method to find these.',
          required => 1,
          in => 'path',
        },
      ],
      responses => { default => {} },
    }, get qr{/api/object/device/(?<ip>[^/]+)/port/(?<port>.+)/${rel}$} => require_role api => sub {
      my $params = captures;
      my $rows = try { schema(vars->{'tenant'})->resultset('DevicePort')
        ->find( $$params{port}, $$params{ip} )->$rel }
        or send_error('Bad Device or Port', 404);
      return to_json [ map {$_->TO_JSON} $rows->all ];
    };
}

foreach my $rel (qw/power properties ssid wireless agg_master neighbor last_node/) {
    swagger_path {
      tags => ['Objects'],
      description => "Returns the related $rel table entry for a given port",
      path => (setting('api_base') || '')."/object/device/{ip}/port/{port}/$rel",
      parameters  => [
        ip => {
          description => 'Canonical IP of the Device. Use Search methods to find this.',
          required => 1,
          in => 'path',
        },
        port => {
          description => 'Name of the port. Use the ".../device/{ip}/ports" method to find these.',
          required => 1,
          in => 'path',
        },
      ],
      responses => { default => {} },
    }, get qr{/api/object/device/(?<ip>[^/]+)/port/(?<port>.+)/${rel}$} => require_role api => sub {
      my $params = captures;
      my $row = try { schema(vars->{'tenant'})->resultset('DevicePort')
        ->find( $$params{port}, $$params{ip} )->$rel }
        or send_error('Bad Device or Port', 404);
      return to_json $row->TO_JSON;
    };
}

# must come after the port methods above, so the route matches later
swagger_path {
  tags => ['Objects'],
  description => 'Returns a row from the device_port table',
  path => (setting('api_base') || '').'/object/device/{ip}/port/{port}',
  parameters  => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
    port => {
      description => 'Name of the port. Use the ".../device/{ip}/ports" method to find these.',
      required => 1,
      in => 'path',
    },
  ],
  responses => { default => {} },
}, get qr{/api/object/device/(?<ip>[^/]+)/port/(?<port>.+)$} => require_role api => sub {
  my $params = captures;
  my $port = try { schema(vars->{'tenant'})->resultset('DevicePort')
    ->find( $$params{port}, $$params{ip} ) }
    or send_error('Bad Device or Port', 404);
  return to_json $port->TO_JSON;
};

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/device/{ip}/nodes',
  description => "Returns the nodes found on a given Device",
  parameters  => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
    active_only => {
      description => 'Restrict results to active Nodes only',
      type => 'boolean',
      default => 'true',
      in => 'query',
    },
  ],
  responses => { default => {} },
}, get '/api/object/device/:ip/nodes' => require_role api => sub {
  my $active = (params->{active_only} and ('true' eq params->{active_only})) ? 1 : 0;
  my $rows = try { schema(vars->{'tenant'})->resultset('Node')
    ->search({ switch => params->{ip}, ($active ? (-bool => 'active') : ()) }) }
    or send_error('Bad Device', 404);
  return to_json [ map {$_->TO_JSON} $rows->all ];
};

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/device/{ip}/nodes',
  description => "Queue a job to store the nodes found on a given Device",
  parameters  => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
    nodes => {
      description => 'List of node tuples (port, VLAN, MAC)',
      default => '[]',
      schema => {
        type => 'array',
        items => {
          type => 'object',
          properties => {
            port => {
              type => 'string'
            },
            vlan => {
              type => 'integer',
              default => '1'
            },
            mac => {
              type => 'string'
            }
          }
        }
      },
      in => 'body',
    },
  ],
  responses => { default => {} },
}, put '/api/object/device/:ip/nodes' => require_role setting('defanged_api_admin') => sub {

  jq_insert([{
    action => 'macsuck',
    device => params->{ip},
    subaction => request->body,
    username => session('logged_in_user'),
    userip => request->remote_address,
  }]);

  return to_json {};
};

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/vlan/{vlan}/nodes',
  description => "Returns the nodes found in a given VLAN",
  parameters  => [
    vlan => {
      description => 'VLAN number',
      type => 'integer',
      required => 1,
      in => 'path',
    },
    active_only => {
      description => 'Restrict results to active Nodes only',
      type => 'boolean',
      default => 'true',
      in => 'query',
    },
  ],
  responses => { default => {} },
}, get '/api/object/vlan/:vlan/nodes' => require_role api => sub {
  my $active = (params->{active_only} and ('true' eq params->{active_only})) ? 1 : 0;
  my $rows = try { schema(vars->{'tenant'})->resultset('Node')
    ->search({ vlan => params->{vlan}, ($active ? (-bool => 'active') : ()) }) }
    or send_error('Bad VLAN', 404);
  return to_json [ map {$_->TO_JSON} $rows->all ];
};

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/device/{ip}/arps',
  description => "Queue a job to store the ARP entries found on a given Device",
  parameters  => [
    ip => {
      description => 'Canonical IP of the Device. Use Search methods to find this.',
      required => 1,
      in => 'path',
    },
    arps => {
      description => 'List of arp tuples (MAC, IP, DNS?). IPs will be resolved to FQDN by Netdisco.',
      default => '[]',
      schema => {
        type => 'array',
        items => {
          type => 'object',
          properties => {
            mac => {
              type => 'string',
              required => 1,
            },
            ip => {
              type => 'string',
              required => 1,
            },
            dns => {
              type => 'string',
              required => 0,
            }
          }
        }
      },
      in => 'body',
    },
  ],
  responses => { default => {} },
}, put '/api/object/device/:ip/arps' => require_role setting('defanged_api_admin') => sub {

  jq_insert([{
    action => 'arpnip',
    device => params->{ip},
    subaction => request->body,
    username => session('logged_in_user'),
    userip => request->remote_address,
  }]);

  return to_json {};
};

# Resolve an arbitrary IP (e.g. a traceroute hop) against everything in the DB:
# a device's management IP, a device interface alias (device_ip), or a host
# (node_ip). Returns the most specific match so the UI can show what the hop is.
sub _dev_brief {
  my ($dev) = @_;
  return undef unless $dev;
  return {
    ip     => "".$dev->ip,
    name   => $dev->name,
    dns    => $dev->dns,
    vendor => $dev->vendor,
    model  => ($dev->model || undef),
    os     => $dev->os,
    os_ver => $dev->os_ver,
  };
}

swagger_path {
  tags => ['Objects'],
  path => (setting('api_base') || '').'/object/ip/{ip}',
  description => 'Resolve an IP to a device, device interface, or host node',
  parameters  => [ ip => { description => 'IP address to resolve', required => 1, in => 'path' } ],
  responses => { default => {} },
}, get '/api/object/ip/:ip' => require_role api => sub {
  my $schema = schema(vars->{'tenant'});
  my $ip = params->{ip};

  # 1. Device management IP (exact).
  my $dev = try { $schema->resultset('Device')->find($ip) };
  return to_json { ip => $ip, kind => 'device', device => _dev_brief($dev) } if $dev;

  # 2. Device interface alias (router/switch interface IP).
  my $alias = try { $schema->resultset('DeviceIp')->search({ alias => $ip }, { rows => 1 })->first };
  if ($alias) {
    my $owner = try { $schema->resultset('Device')->find($alias->get_column('ip')) };
    return to_json {
      ip => $ip, kind => 'device-interface',
      device => _dev_brief($owner) || { ip => "".$alias->get_column('ip') },
      port   => $alias->get_column('port'),
      dns    => $alias->dns,
      subnet => ($alias->get_column('subnet') ? "".$alias->get_column('subnet') : undef),
    };
  }

  # 3. Host / endpoint (most recent node sighting for this IP).
  my $nip = try { $schema->resultset('NodeIp')
    ->search({ ip => $ip }, { order_by => { -desc => 'time_last' }, rows => 1 })->first };
  if ($nip) {
    my $node = try { $schema->resultset('Node')
      ->search({ mac => $nip->get_column('mac') }, { order_by => { -desc => 'time_last' }, rows => 1 })->first };
    return to_json {
      ip => $ip, kind => 'host',
      mac       => "".$nip->get_column('mac'),
      dns       => $nip->dns,
      active    => ($nip->active ? \1 : \0),
      vrf       => ($nip->get_column('vrf') || undef),
      last_seen => ($nip->time_last ? "".$nip->time_last : undef),
      switch    => ($node ? "".$node->get_column('switch') : undef),
      port      => ($node ? $node->get_column('port') : undef),
      vlan      => ($node ? $node->get_column('vlan') : undef),
    };
  }

  return to_json { ip => $ip, kind => 'unknown' };
};

true;
