package App::Crawler::Web::API::Meta;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use App::Crawler;

our $CRAWLER_VERSION = $App::Crawler::VERSION;

get '/info' => sub {
    content_type 'application/json';
    return to_json {
        service => 'netstacks-crawler',
        version => $CRAWLER_VERSION,
        ui      => (setting('web_ui') && setting('web_ui')->{enabled}) ? 'enabled' : 'disabled',
        docs    => '/swagger-ui',
    };
};

swagger_path {
    description => 'Crawler version and feature flags',
    tags        => ['meta'],
    responses   => { default => {} },
},
get '/api/version' => sub {
    content_type 'application/json';
    my $schema_version;
    eval {
        require App::Crawler::DB;
        $schema_version = schema('netdisco')->resultset('Statistic')
            ->search({ device_count => { '>=' => 0 } })->get_column('day')->max // 'unknown';
    };
    return to_json {
        crawler_version => $CRAWLER_VERSION,
        schema_version  => ($schema_version // 'unknown'),
        features => {
            web_ui => (setting('web_ui') && setting('web_ui')->{enabled}) ? 1 : 0,
        },
    };
};

1;
