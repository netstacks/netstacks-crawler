package App::Crawler::Web::API::Node;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;

swagger_path {
    description => 'Most recent node record by MAC',
    tags        => ['node'],
    parameters  => [{ name => 'mac', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
get '/api/node/:mac' => require_role api => sub {
    content_type 'application/json';
    my $mac = param('mac');
    my $node = schema('netdisco')->resultset('Node')
        ->search({ mac => $mac }, { order_by => { -desc => 'time_last' }, rows => 1 })
        ->first;
    unless ($node) { status 404; return to_json { error => "node $mac not found" } }
    return to_json { $node->get_columns };
};

swagger_path {
    description => 'Sightings history for a MAC',
    tags        => ['node'],
    parameters  => [{ name => 'mac', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
get '/api/node/:mac/history' => require_role api => sub {
    content_type 'application/json';
    my $mac = param('mac');
    my @rows = schema('netdisco')->resultset('Node')
        ->search({ mac => $mac }, { order_by => { -desc => 'time_last' } })
        ->all;
    return to_json { history => [ map { +{ $_->get_columns } } @rows ] };
};

1;
