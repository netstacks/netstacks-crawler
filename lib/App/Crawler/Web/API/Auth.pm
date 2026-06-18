package App::Crawler::Web::API::Auth;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use JSON::PP qw(decode_json);
use App::Crawler::Util::Web 'ensure_remote_user';

# Session-based login for the SPA. nginx only proxies /api/*, so the legacy
# /login (which also mints an expiring API token) isn't reachable from the UI.
# These endpoints establish a normal session cookie — no token dance — reusing
# the same provider (bcrypt/LDAP/RADIUS/TACACS) as everything else.

sub _roles_for {
    my $username = shift or return [];
    my $provider = Dancer::Plugin::Auth::Extensible::auth_provider('users');
    return [ sort @{ $provider->get_user_roles($username) || [] } ];
}

swagger_path {
    description => 'Log in with username + password, establishing a session cookie',
    tags        => ['auth'],
    responses   => { default => {} },
},
post '/api/auth/login' => sub {
    content_type 'application/json';

    my $args = {};
    if (request->body) { eval { $args = decode_json(request->body); 1 } or ($args = {}); }
    my $username = $args->{username} // param('username');
    my $password = $args->{password} // param('password');

    unless (defined $username and length $username) {
        status 400;
        return to_json { error => 'username and password required' };
    }

    my ($success, $realm) = authenticate_user($username, $password);
    unless ($success) {
        session->destroy;
        schema('netdisco')->resultset('UserLog')->create({
          username => $username,
          userip   => request->remote_address,
          event    => 'Login Failure (API)',
          details  => 'auth/login',
        });
        status 401;
        return to_json { error => 'authentication failed' };
    }

    my $provider = Dancer::Plugin::Auth::Extensible::auth_provider('users');
    my $user = $provider->get_user_details($username);

    # a disabled account may not log in (built-in admin can be disabled this way)
    if ($user and defined $user->active and not $user->active) {
        session->destroy;
        status 403;
        return to_json { error => 'account is disabled' };
    }

    session logged_in_user       => $user->username;
    session logged_in_fullname   => ($user->fullname || '');
    session logged_in_user_realm => ($realm || 'users');

    eval { $user->update({ last_on => \'LOCALTIMESTAMP' }) };
    schema('netdisco')->resultset('UserLog')->create({
      username => $user->username,
      userip   => request->remote_address,
      event    => 'Login (API)',
      details  => 'auth/login',
    });

    return to_json {
      username => $user->username,
      fullname => ($user->fullname || ''),
      roles    => _roles_for($user->username),
    };
};

swagger_path {
    description => 'Destroy the current session',
    tags        => ['auth'],
    responses   => { default => {} },
},
post '/api/auth/logout' => sub {
    content_type 'application/json';
    my $who = session('logged_in_user');
    session->destroy;
    if ($who) {
        schema('netdisco')->resultset('UserLog')->create({
          username => $who,
          userip   => request->remote_address,
          event    => 'Logout (API)',
          details  => 'auth/logout',
        });
    }
    return to_json { ok => \1 };
};

swagger_path {
    description => 'Return the current authenticated identity and roles',
    tags        => ['auth'],
    responses   => { default => {} },
},
swagger_path {
    description => 'Public branding (application name) for unauthenticated pages like login',
    tags        => ['auth'],
    responses   => { default => {} },
},
get '/api/auth/branding' => sub {
    content_type 'application/json';
    # Exempt from the auth hook (path under /api/auth/), so the login page can
    # read the configured name before anyone is signed in.
    return to_json {
      application_name => (setting('application_name') || 'NetStacks Crawler'),
    };
};

get '/api/auth/whoami' => sub {
    content_type 'application/json';

    # This route is exempt from the auth before-hook, so resolve identity the
    # same way the hook would: existing session, else trusted proxy header,
    # else the open (no_auth) guest.
    my $who    = session('logged_in_user');
    my $source = 'session';
    if (not $who) {
        if (setting('trust_x_remote_user')
            and scalar request->header('X-REMOTE_USER')
            and length scalar request->header('X-REMOTE_USER')) {
            ($who = scalar request->header('X-REMOTE_USER')) =~ s/@[^@]*$//;
            $source = 'remote';
        }
        elsif (setting('no_auth')) {
            $who = 'guest';
            $source = 'no_auth';
        }
    }

    unless ($who) {
        return to_json { authenticated => \0 };
    }

    # whoami is exempt from the before-hook, so a whoami-first request must
    # provision the SSO user here too, otherwise _roles_for finds no row and
    # returns no roles.
    ensure_remote_user($who) if $source eq 'remote';

    return to_json {
      authenticated => \1,
      username      => $who,
      fullname      => (session('logged_in_fullname') || ''),
      source        => $source,
      roles         => _roles_for($who),
    };
};

1;
