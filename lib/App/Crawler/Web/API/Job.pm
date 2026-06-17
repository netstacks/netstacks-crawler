package App::Crawler::Web::API::Job;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use App::Crawler::JobQueue qw/jq_insert/;
use JSON::PP qw(decode_json);

swagger_path {
    description => 'List recent jobs',
    tags        => ['job'],
    parameters  => [
        { name => 'limit',  in => 'query', type => 'integer', required => 0 },
        { name => 'status', in => 'query', type => 'string',  required => 0 },
    ],
    responses   => { default => {} },
},
get '/api/job' => require_role api => sub {
    content_type 'application/json';
    my $limit  = int(param('limit') // 100);
    my $status = param('status');
    my %where = $status ? (status => $status) : ();
    my @rows = schema('netdisco')->resultset('Admin')
        ->search(\%where, { order_by => { -desc => 'entered' }, rows => $limit })
        ->all;
    return to_json { jobs => [ map { +{ $_->get_columns } } @rows ] };
};

swagger_path {
    description => 'Get job status by id',
    tags        => ['job'],
    parameters  => [{ name => 'id', in => 'path', type => 'integer', required => 1 }],
    responses   => { default => {} },
},
get '/api/job/:id' => require_role api => sub {
    content_type 'application/json';
    my $row = schema('netdisco')->resultset('Admin')->find(param('id'));
    unless ($row) { status 404; return to_json { error => 'job not found' } }
    return to_json { +{ $row->get_columns } };
};

swagger_path {
    description => 'Submit a new job',
    tags        => ['job'],
    responses   => { default => {} },
},
post '/api/job' => require_role admin => sub {
    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }
    unless ($args->{action}) {
        status 400;
        return to_json { error => 'action required' };
    }
    my $id = jq_insert({
        device    => $args->{device},
        port      => $args->{port},
        action    => $args->{action},
        subaction => $args->{subaction},
        username  => session('logged_in_user'),
        userip    => request->remote_address,
    });
    return to_json { job_id => $id };
};

1;
