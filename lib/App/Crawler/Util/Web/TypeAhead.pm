package App::Crawler::Util::Web::TypeAhead;

use strict;
use warnings;

use Dancer::Plugin::DBIC;
use Dancer ':syntax';
use App::Crawler::Util::Web (); # for sort_port
use HTML::Entities 'encode_entities';
use List::MoreUtils ();
use Exporter 'import';

our @EXPORT_OK = qw(
    typeahead_device
    typeahead_device_ip
    typeahead_device_name
    typeahead_port
    typeahead_subnet
);

# Each sub takes ($query_string, %params) and returns an arrayref of match strings/objects.

sub typeahead_device_name {
    my ($q, %params) = @_;
    return [] unless setting('navbar_autocomplete');

    my $set = schema($params{tenant})->resultset('Device')
      ->search_fuzzy($q)->search(undef, {rows => setting('max_typeahead_rows')});

    return [map {encode_entities($_->dns || $_->name || $_->ip)} $set->all];
}

sub typeahead_device_ip {
    my ($q, %params) = @_;
    my $set = schema($params{tenant})->resultset('Device')
      ->search_fuzzy($q)->search(undef, {rows => setting('max_typeahead_rows')});

    my @data = ();
    while (my $d = $set->next) {
        my $label = $d->ip;
        if ($d->dns or $d->name) {
            $label = sprintf '%s (%s)',
              ($d->dns || $d->name), $d->ip;
        }
        push @data, { label => $label, value => $d->ip };
    }

    return \@data;
}

sub typeahead_device {
    my ($q, %params) = @_;
    return [] unless $q;

    my $mode = $params{aclhost} || 'ip';

    my @data = ();

    # TODO add in entries from the database
    my @host_groups = sort {$a cmp $b}
                      grep {$_ !~ m/^synthesized_group_/}
                      keys %{ setting('host_groups')};

    # if q starts group: then search for host groups (excluding synthesized)
    if ($q =~ m/^(?:group:|acl:)/i) {
       return [ map { 'group:'. $_ } @host_groups ];
    }

    if (scalar grep { $_ =~ m/\Q$q\E/i } @host_groups) {
        push @data, map { 'group:'. $_ }
                    grep { $_ =~ m/\Q$q\E/i } @host_groups
    }

    my $set = schema($params{tenant})->resultset('Device')
      ->search_fuzzy($q)->search(undef, {rows => setting('max_typeahead_rows')});

    while (my $d = $set->next) {
        my $name = ($d->dns || $d->name);

        if (not $name or $mode eq 'ip') {
            push @data, { value => $d->ip, label => ($name ? sprintf('%s (%s)', $d->ip, $name) : $d->ip)  };
        }
        elsif ($mode eq 'name') {
            push @data, { value => $name, label => sprintf('%s (%s)', $name, $d->ip) };
        }
    }

    return \@data;
}

sub typeahead_port {
    my ($q, %params) = @_;
    my $dev = $params{dev};
    return [] unless $dev;

    my $device = schema($params{tenant})->resultset('Device')
      ->find({ip => $dev});
    return [] unless $device;

    my $set = $device->ports({},{order_by => 'port'});
    $set = $set->search({port => { -ilike => "\%$q\%" }})
      if $q;

    my $results = [
      map  {{ label => (sprintf "%s (%s)", $_->port, ($_->name || '')), value => $_->port }}
      sort { &App::Crawler::Util::Web::sort_port($a->port, $b->port) } $set->all
    ];

    return $results;
}

sub typeahead_subnet {
    my ($q, %params) = @_;
    $q = "$q\%" if $q !~ m/\%/;
    my $nets = schema($params{tenant})->resultset('Subnet')->search(
           { 'me.net::text'  => { '-ilike' => $q }},
           { columns => ['net'], order_by => 'net', rows => setting('max_typeahead_rows') } );

    return [map {$_->net} $nets->all];
}

1;
