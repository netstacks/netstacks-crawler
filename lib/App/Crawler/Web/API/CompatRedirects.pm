package App::Crawler::Web::API::CompatRedirects;

use strict;
use warnings;

use Dancer ':syntax';

# One-release backward-compat shim. The API used to live at /api/v1/* and
# /api/v2/* — SP7-M1 collapsed both into the unversioned /api/*. Any external
# script or copy-pasted dashboard layout that still uses the old prefix gets
# a 308 (preserves method + body) to the new path. Drop this module when we
# are confident no consumer cares.

sub _redirect_no_version {
    my $orig = request->path_info;
    my $rest = $orig;
    $rest =~ s{^/api/v[12]/}{/api/};

    my $qs = request->env->{'QUERY_STRING'};
    $rest .= '?' . $qs if defined $qs && length $qs;

    status 308;
    header 'Location' => $rest;
    return '';
}

# Match any HTTP method against the legacy paths.
for my $verb (qw/get post put del patch/) {
    no strict 'refs';
    &{$verb}(qr{^/api/v[12]/.+$} => \&_redirect_no_version);
}

1;
