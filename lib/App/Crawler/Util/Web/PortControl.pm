package App::Crawler::Util::Web::PortControl;

use strict;
use warnings;

use Dancer::Plugin::DBIC;
use App::Crawler::JobQueue qw/jq_insert/;
use Exporter 'import';

our @EXPORT_OK = qw(submit_portcontrol_job);

# Returns ($job_id, $error_string). On success $error_string is undef.
sub submit_portcontrol_job {
    my ($args, $username, $userip) = @_;

    return (undef, 'No device/port/field')
        unless $args->{device} and ($args->{port} or $args->{field});

    my %action_map = (
        location => 'location',
        contact  => 'contact',
        c_port   => 'portcontrol',
        c_name   => 'portname',
        c_pvid   => 'vlan',
        c_power  => 'power',
    );

    my $action = ($action_map{ $args->{field} // '' } || $args->{field} || '');
    my $subaction = ($action =~ m/^(?:power|portcontrol)/
        ? ($args->{action} . '-other')
        : $args->{value});

    my $job_id;
    schema('netdisco')->txn_do(sub {
        if ($args->{port}) {
            my $act = "$action $subaction";
            $act =~ s/-other$//;
            $act =~ s/^portcontrol/port/;
            $act =~ s/^device_port_custom_field_/custom_field: /;

            schema('netdisco')->resultset('DevicePortLog')->create({
                ip       => $args->{device},
                port     => $args->{port},
                action   => $act,
                username => $username,
                userip   => $userip,
                reason   => ($args->{reason} || 'other'),
                log      => $args->{log},
            });
        }

        $job_id = jq_insert({
            device    => $args->{device},
            port      => $args->{port},
            action    => $action,
            subaction => $subaction,
            username  => $username,
            userip    => $userip,
        });
    });

    return ($job_id, undef);
}

1;
