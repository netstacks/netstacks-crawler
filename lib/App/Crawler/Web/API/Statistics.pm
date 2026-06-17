package App::Crawler::Web::API::Statistics;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Swagger;
use Dancer::Plugin::Auth::Extensible;

use Try::Tiny;

# Legacy single-row endpoint (was /api/v1/statistics — now unversioned).
swagger_path {
  tags => ['stats'],
  path => (setting('api_base') || '').'/statistics',
  description => 'Returns the latest row from the statistics table',
  parameters => [],
  responses => { default => {} },
}, get '/api/statistics' => require_role api => sub {
  my $stats = try {
    schema(vars->{'tenant'})->resultset('Statistics')
      ->search(undef, { order_by => { -desc => 'day' }, rows => 1 })->first
  } or send_error('No statistics available', 404);

  return to_json $stats->TO_JSON;
};

# Summary panel data — latest row + 30-day history (was /api/v2/stats/summary).
swagger_path {
    description => 'Latest statistics row plus last-30-days history',
    tags        => ['stats'],
    responses   => { default => {} },
},
get '/api/stats/summary' => require_role api => sub {
    content_type 'application/json';

    my $sch = schema('netdisco');

    # Live counts — always current, not dependent on the stats worker.
    my $live = {
        device_count         => $sch->resultset('Device')->count + 0,
        device_ip_count      => $sch->resultset('DeviceIp')->count + 0,
        device_port_count    => $sch->resultset('DevicePort')->count + 0,
        device_port_up_count => $sch->resultset('DevicePort')->search({ up => 'up' })->count + 0,
        device_link_count    => $sch->resultset('DevicePort')->search({ remote_ip => { '!=' => undef } })->count + 0,
        node_active_count    => $sch->resultset('Node')->search({ -bool => 'active' })->count + 0,
        phone_count          => 0,
    };

    my $rs = $sch->resultset('Statistics');
    my @history = $rs->search({}, { order_by => { -asc  => 'day' }, rows => 30 })->hri->all;

    return to_json {
        latest  => $live,
        history => \@history,
    };
};

# Operational rollups (was /api/v2/stats/operational).
swagger_path {
    description => 'Operational health rollups: slow / timed-out / orphaned / undiscovered devices + queue counts',
    tags        => ['stats'],
    responses   => { default => {} },
},
get '/api/stats/operational' => require_role api => sub {
    content_type 'application/json';

    my $sch = schema('netdisco');

    my @slow = $sch->resultset('Device')->search(
        { last_discover => { '!=' => undef } },
        {
            order_by => { -desc => 'last_discover' },
            rows     => 5,
            columns  => [qw/ip dns name vendor model last_discover/],
        },
    )->hri->all;

    my @timed_out = $sch->resultset('Admin')->search(
        {
            action   => 'discover',
            status   => 'error',
            finished => { '>' => \"NOW() - INTERVAL '24 hours'" },
        },
        {
            order_by => { -desc => 'finished' },
            rows     => 10,
            columns  => [qw/job device log finished/],
        },
    )->hri->all;

    my @orphaned = $sch->resultset('Device')->search(
        {
            ip => {
                -not_in => $sch->resultset('DevicePort')->search(
                    { remote_ip => { '!=' => undef } },
                    { columns => ['ip'], distinct => 1 },
                )->as_query,
            },
        },
        { rows => 10, columns => [qw/ip dns name vendor model/] },
    )->hri->all;

    my @undiscovered = $sch->resultset('DevicePort')->search(
        {
            remote_ip => {
                '!=' => undef,
                -not_in => $sch->resultset('Device')->search(
                    {}, { columns => ['ip'] },
                )->as_query,
            },
        },
        {
            rows     => 10,
            columns  => [qw/remote_ip remote_id remote_type ip port/],
            group_by => [qw/remote_ip remote_id remote_type ip port/],
        },
    )->hri->all;

    my $queue = {
        queued      => $sch->resultset('Admin')->search({ status => 'queued'      })->count + 0,
        in_progress => $sch->resultset('Admin')->search({ status => 'in-progress' })->count + 0,
        done_24h    => $sch->resultset('Admin')->search({
            status   => 'done',
            finished => { '>' => \"NOW() - INTERVAL '24 hours'" },
        })->count + 0,
        error_24h   => $sch->resultset('Admin')->search({
            status   => 'error',
            finished => { '>' => \"NOW() - INTERVAL '24 hours'" },
        })->count + 0,
    };

    return to_json {
        slow_devices           => \@slow,
        timed_out_devices      => \@timed_out,
        orphaned_devices       => \@orphaned,
        duplicate_devices      => [],
        undiscovered_neighbors => \@undiscovered,
        job_queue              => $queue,
    };
};

true;
