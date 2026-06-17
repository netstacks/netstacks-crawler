package App::Crawler::Web::API::TypeAhead;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use App::Crawler::Util::Web::TypeAhead qw(
    typeahead_device typeahead_device_ip typeahead_device_name
    typeahead_port typeahead_subnet
);

my %routes = (
    'device'      => sub {
        my $q = param('q') || param('device_rule') || '';
        my $mode = param('aclhost') || 'ip';
        if ($mode eq 'dynamic') {
            $mode = (($q =~ m/^\d/ or $q =~ m/:/) ? 'ip' : 'name');
        }
        return typeahead_device($q, tenant => vars->{'tenant'}, aclhost => $mode);
    },
    'device-ip'   => sub {
        my $q = param('q') || param('query') || param('term') || '';
        return typeahead_device_ip($q, tenant => vars->{'tenant'});
    },
    'device-name' => sub {
        my $q = param('q') || param('query') || param('term') || '';
        return typeahead_device_name($q, tenant => vars->{'tenant'});
    },
    'port'        => sub {
        my $q = param('q') || param('port') || param('port1') || param('port2') || '';
        my $dev = param('dev') || param('dev1') || param('dev2') || '';
        return typeahead_port($q, tenant => vars->{'tenant'}, dev => $dev);
    },
    'subnet'      => sub {
        my $q = param('q') || param('query') || param('term') || '';
        return typeahead_subnet($q, tenant => vars->{'tenant'});
    },
);

for my $kind (sort keys %routes) {
    my $handler = $routes{$kind};
    swagger_path {
        description => "Type-ahead suggestions for $kind",
        tags        => ['typeahead'],
        parameters  => [
            { name => 'q', in => 'query', type => 'string', required => 0 },
        ],
        responses   => { default => {} },
    },
    get "/api/typeahead/$kind" => require_role api => sub {
        content_type 'application/json';
        return to_json { matches => $handler->() };
    };
}

1;
