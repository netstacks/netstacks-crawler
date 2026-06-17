package App::Crawler::Web::API::DeviceList;
use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;

my %SORT_COLS = map { $_ => 1 } qw(ip dns name model os vendor location contact);

sub _query_devices {
    my %p = @_;
    my $page      = int($p{page}      // 1);
    my $page_size = int($p{page_size} // 50);
    $page_size = 200 if $page_size > 200;
    $page_size = 1   if $page_size < 1;
    $page = 1 if $page < 1;

    my ($sort_col, $sort_dir) = ('name', 'asc');
    if ($p{sort}) {
        my ($c, $d) = split /,/, $p{sort};
        $sort_col = $c if $SORT_COLS{$c};
        $sort_dir = (lc($d // '') eq 'desc') ? 'desc' : 'asc';
    }

    my %where;
    if (defined $p{q} && length $p{q}) {
        my $like = '%' . $p{q} . '%';
        # Mirror the global search field coverage so the page filter and the
        # top-bar search agree on what "matches" means. Module-serial hits use
        # a subquery against device_module since that's a separate table.
        $where{-or} = [
            { name        => { ilike => $like } },
            { dns         => { ilike => $like } },
            { 'ip::text'  => { ilike => $like } },
            { location    => { ilike => $like } },
            { model       => { ilike => $like } },
            { vendor      => { ilike => $like } },
            { os          => { ilike => $like } },
            { os_ver      => { ilike => $like } },
            { description => { ilike => $like } },
            { contact     => { ilike => $like } },
            { serial      => { ilike => $like } },
            { chassis_id  => { ilike => $like } },
            { 'me.ip' => { -in =>
                schema('netdisco')->resultset('DeviceModule')->search(
                    { serial => { ilike => $like } },
                    { columns => 'ip' },
                )->as_query
            } },
        ];
    }

    my $rs = schema('netdisco')->resultset('Device')->search(
        \%where,
        {
            order_by => { "-$sort_dir" => $sort_col },
            rows     => $page_size,
            page     => $page,
        },
    );

    my $total = $rs->pager->total_entries;
    my @rows  = map { +{ $_->get_columns } } $rs->all;

    # Derive chassis_model from the device_module chassis row (parent IS NULL)
    # for any device whose model column is empty or a bare SNMP type-suffix
    # (e.g. ".154" from jnxChassis.154). The real model lives in the chassis
    # row's `name` (e.g. "JNP10008-CHAS") or `description` ("Juniper QFX5120-32C Switch").
    if (@rows) {
        my @ips = map { $_->{ip} } @rows;
        my %chassis;
        my $modrs = schema('netdisco')->resultset('DeviceModule')->search(
            { ip => { -in => \@ips }, parent => undef },
            { columns => [qw/ ip name description /] },
        );
        while (my $m = $modrs->next) {
            my $name = $m->name // '';
            my $desc = $m->description // '';
            my $model;
            if ($name =~ /\S/) {
                $model = $name;
                $model =~ s/-CHAS\b//;   # Juniper chassis suffix
            }
            elsif ($desc =~ /\S/) {
                ($model = $desc) =~ s/^(?:Juniper|Cisco|Arista|HP|Dell)\s+//i;
                $model =~ s/\s+(?:Switch|Router|Chassis)\s*$//i;
            }
            $chassis{ $m->ip } = $model if defined $model && length $model;
        }
        for my $r (@rows) {
            my $bogus = !defined $r->{model}
                     || $r->{model} eq ''
                     || $r->{model} =~ /^\.?\d+$/;   # ".154", "154", etc.
            $r->{chassis_model} = $chassis{ $r->{ip} } if $bogus && $chassis{ $r->{ip} };
        }
    }

    return (\@rows, $total, $page, $page_size);
}

swagger_path {
    description => 'List devices, paginated, sortable, filterable',
    tags        => ['device'],
    parameters  => [
        { name => 'page',      in => 'query', type => 'integer' },
        { name => 'page_size', in => 'query', type => 'integer' },
        { name => 'sort',      in => 'query', type => 'string' },
        { name => 'q',         in => 'query', type => 'string' },
    ],
    responses => { default => {} },
},
get '/api/devices' => require_role api => sub {
    content_type 'application/json';
    my ($rows, $total, $page, $page_size) = _query_devices(
        page      => param('page'),
        page_size => param('page_size'),
        sort      => param('sort'),
        q         => param('q'),
    );
    return to_json {
        devices   => $rows,
        total     => $total,
        page      => $page,
        page_size => $page_size,
    };
};

get '/api/devices.csv' => require_role api => sub {
    content_type 'text/csv';
    my ($rows) = _query_devices(
        sort      => param('sort'),
        q         => param('q'),
        page_size => 100000,
    );
    return '' unless @$rows;
    my @cols = sort keys %{ $rows->[0] };
    my $out  = join(',', @cols) . "\n";
    for my $r (@$rows) {
        $out .= join(',', map { defined $_ ? qq{"$_"} : '' } @{$r}{@cols}) . "\n";
    }
    return $out;
};

1;
