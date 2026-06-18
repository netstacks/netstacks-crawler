package App::Crawler::Web::API::DeviceDetails;
use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;

swagger_path {
    description => 'Denormalized device detail (counts + last-poll status)',
    tags        => ['device'],
    parameters  => [{ name => 'ip', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
get '/api/device/:ip/details' => require_role api => sub {
    content_type 'application/json';
    my $ip  = param('ip');
    my $dev = schema('netdisco')->resultset('Device')->find($ip);
    unless ($dev) { status 404; return to_json { error => "device $ip not found" } }

    my %base = $dev->get_columns;
    my $ports_count   = $dev->ports->count;
    my $vlans_count   = eval { $dev->vlans->count } // 0;
    my $modules_count = eval { $dev->modules->count } // 0;
    my $address_count = eval { $dev->device_ips->count } // 0;
    my $nodes_count   = schema('netdisco')
        ->resultset('Node')->search({ switch => $dev->ip })->count;

    # Mirror DeviceList: derive chassis_model from device_module's chassis row
    # when device.model is empty or a bare SNMP-type suffix (e.g. ".154").
    my $bogus = !defined $base{model} || $base{model} eq '' || $base{model} =~ /^\.?\d+$/;
    if ($bogus) {
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
            $base{chassis_model} = $cm if defined $cm && length $cm;
        }
    }

    return to_json {
        %base,
        counts => {
            ports     => $ports_count,
            nodes     => $nodes_count,
            vlans     => $vlans_count,
            modules   => $modules_count,
            addresses => $address_count,
        },
    };
};

1;
