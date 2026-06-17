package App::Crawler::Web::API::Import;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::Auth::Extensible;
use HTTP::Tiny;
use JSON::PP qw(decode_json);
use App::Crawler::JobQueue qw(jq_insert);

# Server-side fetch proxy for the Admin -> Import feature. A browser cannot read
# a cross-origin API that doesn't send CORS headers, nor talk to a host with a
# self-signed/untrusted TLS cert -- both are enforced by the browser. So the SPA
# hands us the URL and we fetch it here (same-origin to the SPA, no CORS), with
# an opt-in to skip TLS verification for internal IPAM behind a private CA.
#
# Admin-only. This is a generic outbound fetch (an SSRF vector by nature); it is
# intentionally gated to admins and meant for trusted internal inventory sources.
swagger_path {
    description => 'Proxy a GET to an external JSON API (e.g. NetBox) for inventory import',
    tags        => ['import'],
    responses   => { default => {} },
},
post '/api/import/fetch' => require_role admin => sub {
    content_type 'application/json';

    my $args;
    eval { $args = decode_json(request->body || '{}'); 1 }
        or do { status 400; return to_json { error => 'invalid JSON' } };

    my $url = $args->{url} // '';
    unless ($url =~ m{^https?://}i) {
        status 400;
        return to_json { error => 'a valid http(s) url is required' };
    }

    my %headers = (Accept => 'application/json');
    if (defined $args->{header_name} && length $args->{header_name}
        && defined $args->{header_value} && length $args->{header_value}) {
        $headers{ $args->{header_name} } = $args->{header_value};
    }

    my $ua = HTTP::Tiny->new(
        timeout    => 25,
        agent      => 'NetStacks-Crawler-Import/1 ',
        verify_SSL => $args->{insecure} ? 0 : 1,
    );

    my $resp = $ua->get($url, { headers => \%headers });

    # HTTP::Tiny uses status 599 for transport-level failures (DNS, refused,
    # TLS) and puts the reason in content. Pass everything back so the SPA can
    # render a precise message and parse the body itself.
    return to_json {
        ok      => $resp->{success} ? \1 : \0,
        status  => $resp->{status},
        reason  => $resp->{reason},
        content => $resp->{content},
    };
};

# Queue discovery for a whole list of IPs in one request. The importer sends the
# selected IPs as an array; we insert them as a single batch (one transaction)
# rather than the SPA firing one POST /api/job per IP.
swagger_path {
    description => 'Queue an action (default discover) for a list of device IPs',
    tags        => ['import'],
    responses   => { default => {} },
},
post '/api/import/queue' => require_role admin => sub {
    content_type 'application/json';

    my $args;
    eval { $args = decode_json(request->body || '{}'); 1 }
        or do { status 400; return to_json { error => 'invalid JSON' } };

    my $ips = $args->{ips};
    unless (ref $ips eq 'ARRAY' && @$ips) {
        status 400;
        return to_json { error => 'a non-empty ips array is required' };
    }

    my $action = $args->{action} || 'discover';
    my %seen;
    my @ips = grep { defined && length && !$seen{$_}++ } @$ips;

    my @jobs = map { {
        device   => $_,
        action   => $action,
        username => session('logged_in_user'),
        userip   => request->remote_address,
    } } @ips;

    my $ok = jq_insert(\@jobs);
    return to_json {
        ok     => $ok ? \1 : \0,
        queued => $ok ? scalar(@jobs) : 0,
    };
};

1;
