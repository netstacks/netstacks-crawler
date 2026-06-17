package App::Crawler::Web::API::PortControl;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use App::Crawler::Util::Web::PortControl qw(submit_portcontrol_job);
use JSON::PP qw(decode_json);

swagger_path {
    description => 'Submit a port-control action (enqueues job)',
    tags        => ['portcontrol'],
    responses   => { default => {} },
},
any ['post', 'get'] => '/api/portcontrol' => require_any_role [qw(admin port_control)] => sub {
    if (request->method eq 'GET') {
        status 405;
        content_type 'application/json';
        return to_json { error => 'Method Not Allowed. Use POST.' };
    }

    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }
    my ($job_id, $err) = submit_portcontrol_job(
        $args,
        session('logged_in_user'),
        request->remote_address,
    );
    if ($err) { status 400; return to_json { error => $err } }
    return to_json { job_id => $job_id };
};

swagger_path {
    description => 'Recent port-control log entries',
    tags        => ['portcontrol'],
    parameters  => [
        { name => 'limit', in => 'query', type => 'integer', required => 0 },
    ],
    responses   => { default => {} },
},
get '/api/portcontrol/log' => require_role api => sub {
    content_type 'application/json';
    my $limit = int(param('limit') // 100);
    my @rows = schema('netdisco')->resultset('DevicePortLog')
        ->search({}, { order_by => { -desc => 'creation' }, rows => $limit })
        ->all;
    return to_json { entries => [ map { +{ $_->get_columns } } @rows ] };
};

1;
