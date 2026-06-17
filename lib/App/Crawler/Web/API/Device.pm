package App::Crawler::Web::API::Device;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;

sub _device_or_404 {
    my $ip = shift;
    my $dev = schema('netdisco')->resultset('Device')->find($ip);
    return $dev if $dev;
    status 404;
    halt to_json { error => "device $ip not found" };
}

swagger_path {
    description => 'Full device record',
    tags        => ['device'],
    parameters  => [{ name => 'ip', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
get '/api/device/:ip' => require_role api => sub {
    content_type 'application/json';
    my $dev = _device_or_404(param('ip'));
    return to_json { +{ $dev->get_columns } };
};

my %subres = (
    ports   => sub { my $d = shift; [ map { +{ $_->get_columns } } $d->ports->all ] },
    nodes   => sub {
        my $d = shift;
        [ map { +{ $_->get_columns } }
          schema('netdisco')->resultset('Node')->search({ switch => $d->ip })->all ];
    },
    vlans   => sub { my $d = shift; [ map { +{ $_->get_columns } } $d->vlans->all ] },
    modules => sub { my $d = shift; [ map { +{ $_->get_columns } } $d->modules->all ] },
    log     => sub { my $d = shift;
        [ map { +{ $_->get_columns } }
          schema('netdisco')->resultset('DevicePortLog')
            ->search({ ip => $d->ip }, { order_by => { -desc => 'creation' }, rows => 200 })
            ->all ];
    },
);

for my $sub (sort keys %subres) {
    my $fn = $subres{$sub};
    swagger_path {
        description => "Device $sub",
        tags        => ['device'],
        parameters  => [{ name => 'ip', in => 'path', type => 'string', required => 1 }],
        responses   => { default => {} },
    },
    get "/api/device/:ip/$sub" => require_role api => sub {
        content_type 'application/json';
        my $dev = _device_or_404(param('ip'));
        return to_json { $sub => $fn->($dev) };
    };
}

1;
