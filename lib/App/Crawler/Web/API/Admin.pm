package App::Crawler::Web::API::Admin;

use strict;
use warnings;

use Dancer ':syntax';
use Dancer::Plugin::Swagger;
use Dancer::Plugin::DBIC;
use Dancer::Plugin::Auth::Extensible;
use Dancer::Plugin::Passphrase;
use App::Crawler::JobQueue qw/jq_insert/;
use App::Crawler::Util::SettingOverride qw/set_override delete_override/;
use JSON::PP qw(decode_json);

swagger_path {
    description => 'Renumber a device (admin job)',
    tags        => ['admin'],
    responses   => { default => {} },
},
any ['post', 'get'] => '/api/admin/renumber' => require_role admin => sub {
    if (request->method eq 'GET') {
        status 405;
        content_type 'application/json';
        return to_json { error => 'Method Not Allowed. Use POST.' };
    }

    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }
    unless ($args->{old_ip} && $args->{new_ip}) {
        status 400;
        return to_json { error => 'old_ip and new_ip required' };
    }
    my $id = jq_insert({
        action    => 'renumber',
        device    => $args->{old_ip},
        subaction => $args->{new_ip},
        username  => session('logged_in_user'),
        userip    => request->remote_address,
    });
    return to_json { job_id => $id };
};

swagger_path {
    description => 'Request a snapshot of a device',
    tags        => ['admin'],
    responses   => { default => {} },
},
any ['post', 'get'] => '/api/admin/snapshot' => require_role admin => sub {
    if (request->method eq 'GET') {
        status 405;
        content_type 'application/json';
        return to_json { error => 'Method Not Allowed. Use POST.' };
    }

    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }
    unless ($args->{device}) {
        status 400;
        return to_json { error => 'device required' };
    }
    my $id = jq_insert({
        action    => 'snapshot',
        device    => $args->{device},
        username  => session('logged_in_user'),
        userip    => request->remote_address,
    });
    return to_json { job_id => $id };
};

swagger_path {
    description => 'Retrieve snapshot for a device',
    tags        => ['admin'],
    parameters  => [{ name => 'device', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
get '/api/admin/snapshot/:device' => require_role admin => sub {
    content_type 'application/json';
    my @rows = schema('netdisco')->resultset('DeviceBrowser')
        ->search({ ip => param('device') })->hri->all;
    unless (@rows) { status 404; return to_json { error => 'no snapshot' } }
    return to_json { snapshot => \@rows };
};

del '/api/admin/snapshot/:device' => require_role admin => sub {
    content_type 'application/json';
    my $count = schema('netdisco')->resultset('DeviceBrowser')
        ->search({ ip => param('device') })->delete;
    unless ($count) { status 404; return to_json { error => 'no snapshot' } }
    return to_json { deleted => $count };
};

# ---- Jobs (list + cancel) ----

swagger_path {
    description => 'List job queue rows',
    tags        => ['admin'],
    parameters  => [
        { name => 'status', in => 'query', type => 'string',  required => 0 },
        { name => 'limit',  in => 'query', type => 'integer', required => 0 },
    ],
    responses   => { default => {} },
},
get '/api/admin/jobs' => require_role admin => sub {
    content_type 'application/json';
    my %where;
    $where{status} = param('status') if param('status');

    my $limit = int(param('limit') // 200);
    $limit = 200 if $limit < 1 || $limit > 1000;

    my @rows = schema('netdisco')->resultset('Admin')->search(
        \%where,
        { order_by => { -desc => 'job' }, rows => $limit },
    )->hri->all;
    return to_json { jobs => \@rows };
};

swagger_path {
    description => 'Cancel a queued job (only works while status is queued and no worker has picked it up)',
    tags        => ['admin'],
    parameters  => [{ name => 'id', in => 'path', type => 'integer', required => 1 }],
    responses   => { default => {} },
},
del '/api/admin/job/:id' => require_role admin => sub {
    content_type 'application/json';
    my $id  = param('id');
    my $row = schema('netdisco')->resultset('Admin')->find($id);
    unless ($row) { status 404; return to_json { error => 'job not found' } }
    if (($row->status // '') ne 'queued' || defined $row->started) {
        status 409;
        return to_json { error => 'job not cancellable (already started or finished)' };
    }
    $row->delete;
    return to_json { cancelled => $id + 0 };
};

swagger_path {
    description => 'Cancel all queued jobs that no worker has picked up yet. '
                . 'Only removes status=queued/unstarted Admin rows — leaves running, '
                . 'finished, and the skiplist/schedules untouched.',
    tags        => ['admin'],
    parameters  => [
        { name => 'action', in => 'query', type => 'string', required => 0,
          description => 'Optionally restrict to one action (e.g. discover)' },
    ],
    responses   => { default => {} },
},
del '/api/admin/jobs/queued' => require_role admin => sub {
    content_type 'application/json';
    my %where = ( status => 'queued', started => undef );
    $where{action} = param('action') if param('action');
    my $gone = schema('netdisco')->resultset('Admin')->search(\%where)->delete;
    return to_json { cancelled => ($gone || 0) + 0 };
};

# ---- Settings: SNMP communities ----

swagger_path {
    description => 'Get effective SNMP communities (merged YAML + DB overrides)',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/settings/snmp' => require_role admin => sub {
    content_type 'application/json';
    return to_json {
        community    => (setting('community')    || []),
        community_rw => (setting('community_rw') || []),
    };
};

swagger_path {
    description => 'Update SNMP communities (writes setting_override; takes effect on next request)',
    tags        => ['admin'],
    responses   => { default => {} },
},
put '/api/admin/settings/snmp' => require_role admin => sub {
    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }

    for my $field (qw/community community_rw/) {
        next unless exists $args->{$field};
        my $v = $args->{$field};
        unless (ref $v eq 'ARRAY') {
            status 400;
            return to_json { error => "$field must be an array of strings" };
        }
        if (@$v == 0) {
            delete_override($field);
            setting($field => []);  # before-hook already ran this request
        } else {
            set_override($field, $v, session('logged_in_user'));
            setting($field => $v);
        }
    }
    return to_json {
        community    => (setting('community')    || []),
        community_rw => (setting('community_rw') || []),
    };
};

# ---- Settings: device_auth (per-device SNMP overrides) ----

swagger_path {
    description => 'List device_auth entries (merged YAML + DB)',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/device-auth' => require_role admin => sub {
    content_type 'application/json';
    my $list = setting('device_auth') || [];
    my @out;
    my $i = 0;
    for my $e (@$list) {
        push @out, { id => $i++, (ref $e eq 'HASH' ? %$e : ()) };
    }
    return to_json { entries => \@out };
};

swagger_path {
    description => 'Add a device_auth entry (appended to the list, persisted as override)',
    tags        => ['admin'],
    responses   => { default => {} },
},
post '/api/admin/device-auth' => require_role admin => sub {
    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }
    unless (ref $args eq 'HASH' && (exists $args->{community} || exists $args->{user})) {
        status 400;
        return to_json { error => 'entry must include community or user' };
    }
    my $list = [ @{ setting('device_auth') || [] } ];
    push @$list, $args;
    set_override('device_auth', $list, session('logged_in_user'));
    setting(device_auth => $list);  # before-hook already ran this request
    return to_json { added => $#$list + 0, count => scalar(@$list) + 0 };
};

swagger_path {
    description => 'Replace a device_auth entry at index :id',
    tags        => ['admin'],
    parameters  => [{ name => 'id', in => 'path', type => 'integer', required => 1 }],
    responses   => { default => {} },
},
put '/api/admin/device-auth/:id' => require_role admin => sub {
    content_type 'application/json';
    my $id = int(param('id'));
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }

    my $list = [ @{ setting('device_auth') || [] } ];
    if ($id < 0 || $id > $#$list) {
        status 404;
        return to_json { error => 'entry not found' };
    }
    $list->[$id] = $args;
    set_override('device_auth', $list, session('logged_in_user'));
    setting(device_auth => $list);
    return to_json { updated => $id + 0 };
};

swagger_path {
    description => 'Delete the device_auth entry at index :id',
    tags        => ['admin'],
    parameters  => [{ name => 'id', in => 'path', type => 'integer', required => 1 }],
    responses   => { default => {} },
},
del '/api/admin/device-auth/:id' => require_role admin => sub {
    content_type 'application/json';
    my $id = int(param('id'));
    my $list = [ @{ setting('device_auth') || [] } ];
    if ($id < 0 || $id > $#$list) {
        status 404;
        return to_json { error => 'entry not found' };
    }
    splice(@$list, $id, 1);
    if (@$list == 0) {
        delete_override('device_auth');
        setting(device_auth => []);
    } else {
        set_override('device_auth', $list, session('logged_in_user'));
        setting(device_auth => $list);
    }
    return to_json { deleted => $id + 0, count => scalar(@$list) + 0 };
};

# ---- Settings: scheduler ----

swagger_path {
    description => 'List scheduled jobs and their cron expressions',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/schedule' => require_role admin => sub {
    content_type 'application/json';
    my $sched = setting('schedule') || {};
    my %out;
    for my $action (keys %$sched) {
        my $entry = $sched->{$action} || {};
        my $when;
        if (ref $entry eq 'HASH') {
            $when = $entry->{when};
            # `when` may itself be a {min:N} hashref shorthand; serialise as JSON
            $when = $when if ref $when;
        } else {
            $when = $entry;  # bare string short-form
        }
        my $enabled = (ref $entry eq 'HASH' && exists $entry->{enabled})
            ? ($entry->{enabled} ? 1 : 0) : 1;
        $out{$action} = { when => $when, enabled => $enabled };
    }
    return to_json { schedule => \%out };
};

swagger_path {
    description => 'Update the schedule entry for a single action',
    tags        => ['admin'],
    parameters  => [{ name => 'action', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
put '/api/admin/schedule/:action' => require_role admin => sub {
    content_type 'application/json';
    my $action = param('action');
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }

    if (exists $args->{when}) {
        set_override("schedule.$action.when", $args->{when}, session('logged_in_user'));
    }
    if (exists $args->{enabled}) {
        set_override("schedule.$action.enabled", ($args->{enabled} ? 1 : 0), session('logged_in_user'));
    }
    # Apply patch to current request's schedule cache so a subsequent GET in the
    # same response cycle (if any) reads the new value.
    my %sched = %{ setting('schedule') || {} };
    $sched{$action} //= {};
    $sched{$action}{when}    = $args->{when}    if exists $args->{when};
    $sched{$action}{enabled} = ($args->{enabled} ? 1 : 0) if exists $args->{enabled};
    setting(schedule => \%sched);
    return to_json { ok => 1 };
};

# ---- Dashboard layout ----

swagger_path {
    description => 'Get the saved dashboard layout (empty object if unset)',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/dashboard-layout' => require_role admin => sub {
    content_type 'application/json';
    return to_json (setting('dashboard.layout') || {});
};

swagger_path {
    description => 'Replace the saved dashboard layout',
    tags        => ['admin'],
    responses   => { default => {} },
},
put '/api/admin/dashboard-layout' => require_role admin => sub {
    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }
    unless (ref $args eq 'HASH' && ref $args->{panels} eq 'ARRAY') {
        status 400;
        return to_json { error => 'body must be { version, panels: [...] }' };
    }
    set_override('dashboard.layout', $args, session('logged_in_user'));
    setting('dashboard.layout' => $args);
    return to_json $args;
};

# ---- Settings: branding ----

swagger_path {
    description => 'Get branding settings (application name)',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/settings/branding' => require_role admin => sub {
    content_type 'application/json';
    return to_json {
        application_name => (setting('application_name') || 'NetStacks Crawler'),
    };
};

swagger_path {
    description => 'Update branding settings (application name)',
    tags        => ['admin'],
    responses   => { default => {} },
},
put '/api/admin/settings/branding' => require_role admin => sub {
    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }

    if (exists $args->{application_name}) {
        my $name = $args->{application_name};
        if (!defined $name || $name =~ /^\s*$/) {
            delete_override('application_name');
            setting(application_name => undef);
        } else {
            set_override('application_name', $name, session('logged_in_user'));
            setting(application_name => $name);
        }
    }
    return to_json {
        application_name => (setting('application_name') || 'NetStacks Crawler'),
    };
};

# ---- Settings: DNS (toggle reverse-DNS lookups during discovery) ----

swagger_path {
    description => 'Read DNS resolver settings (currently: disabled toggle)',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/settings/dns' => require_role admin => sub {
    content_type 'application/json';
    return to_json {
        disabled => (setting('dns')->{disabled} ? \1 : \0),
    };
};

swagger_path {
    description => 'Update DNS resolver settings. Writes setting_override key dns.disabled; takes effect on next request for web/api and on next worker job pickup.',
    tags        => ['admin'],
    responses   => { default => {} },
},
put '/api/admin/settings/dns' => require_role admin => sub {
    content_type 'application/json';
    my $args;
    eval { $args = decode_json(request->body || '{}'); };
    if ($@) { status 400; return to_json { error => 'invalid JSON' } }

    if (exists $args->{disabled}) {
        my $v = $args->{disabled} ? 1 : 0;
        set_override('dns.disabled', $v, session('logged_in_user'));
        my %dns = %{ setting('dns') || {} };
        $dns{disabled} = $v;
        setting(dns => \%dns);
    }
    return to_json {
        disabled => (setting('dns')->{disabled} ? \1 : \0),
    };
};

# ---- Worker pool visibility ----

swagger_path {
    description => 'Snapshot of the worker pool: queue counts, loaded plugins, runtime config',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/workers' => require_role admin => sub {
    content_type 'application/json';

    my $sch = schema('netdisco');

    my $queued  = $sch->resultset('Admin')->search({ status => 'queued'      })->count + 0;
    my $running = $sch->resultset('Admin')->search({ status => 'in-progress' })->count + 0;

    my $workers_cfg = setting('workers') || {};
    my $py_plugins  = setting('python_worker_plugins') || [];
    my @py_names    = map { ref $_ eq 'HASH' ? (keys %$_)[0] : $_ } @$py_plugins;

    # Loaded Perl Worker plugins are derived from
    # @{ setting('extra_backend_plugins') } + the built-in set; we read the
    # built-in list from a known config key plus any extras the operator added.
    my @builtin_actions = qw/discover discoverall macsuck macwalk arpnip arpwalk
                              nbtstat nbtwalk expire pingsweep loadmibs
                              renumber snapshot portcontrol vlan portname
                              location contact power show stats scheduler/;

    return to_json {
        backends => {
            queued  => $queued,
            running => $running,
        },
        plugins => {
            actions               => \@builtin_actions,
            python_enabled        => (setting('enable_python_worklets') ? 1 : 0),
            python_worker_plugins => \@py_names,
        },
        config => {
            worker_queue   => ($workers_cfg->{queue} // 'PostgreSQL'),
            worker_tasks   => ($workers_cfg->{tasks} // 1),
            non_admin_ok   => (setting('enable_nonadmin_actions') ? 1 : 0),
            non_admin_set  => (setting('nonadmin_actions') || []),
        },
    };
};

# ---- Local users -----------------------------------------------------------

sub _user_public {
    my $u = shift;
    my $source = $u->ldap ? 'ldap' : $u->radius ? 'radius'
               : $u->tacacs ? 'tacacs' : $u->remote ? 'sso' : 'local';
    return {
        username     => $u->username,
        fullname     => ($u->fullname // ''),
        note         => ($u->note // ''),
        admin        => ($u->admin ? \1 : \0),
        port_control => ($u->port_control ? \1 : \0),
        active       => ((not defined $u->active or $u->active) ? \1 : \0),
        has_password => ((defined $u->password and length $u->password) ? \1 : \0),
        source       => $source,
        last_on      => $u->last_on,
        created      => $u->creation,
        builtin      => (lc($u->username) eq 'admin' ? \1 : \0),
    };
}

swagger_path {
    description => 'List local users',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/users' => require_role admin => sub {
    content_type 'application/json';
    my @rows = schema('netdisco')->resultset('User')
        ->search(undef, { order_by => 'username' })->all;
    return to_json { users => [ map { _user_public($_) } @rows ] };
};

swagger_path {
    description => 'Create a local user',
    tags        => ['admin'],
    responses   => { default => {} },
},
post '/api/admin/users' => require_role admin => sub {
    content_type 'application/json';
    my $args; eval { $args = decode_json(request->body || '{}'); 1 }
        or do { status 400; return to_json { error => 'invalid JSON' } };

    my $username = $args->{username} // '';
    $username =~ s/^\s+|\s+$//g;
    unless (length $username) { status 400; return to_json { error => 'username required' } }

    my $rs = schema('netdisco')->resultset('User');
    if ($rs->find({ username => { -ilike => quotemeta($username) } })) {
        status 409; return to_json { error => 'user already exists' };
    }

    my %row = (
        username     => $username,
        fullname     => $args->{fullname},
        note         => $args->{note},
        admin        => ($args->{admin}        ? 1 : 0),
        port_control => ($args->{port_control} ? 1 : 0),
        active       => ((exists $args->{active} and not $args->{active}) ? 0 : 1),
    );
    $row{password} = passphrase($args->{password})->generate
        if defined $args->{password} and length $args->{password};

    my $u = $rs->create(\%row);
    status 201;
    return to_json { user => _user_public($u) };
};

swagger_path {
    description => 'Update a local user (flags, fullname, reset password)',
    tags        => ['admin'],
    parameters  => [{ name => 'username', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
put '/api/admin/users/:username' => require_role admin => sub {
    content_type 'application/json';
    my $u = schema('netdisco')->resultset('User')->find(param('username'));
    unless ($u) { status 404; return to_json { error => 'user not found' } }

    my $args; eval { $args = decode_json(request->body || '{}'); 1 }
        or do { status 400; return to_json { error => 'invalid JSON' } };

    my %upd;
    $upd{fullname}     = $args->{fullname}            if exists $args->{fullname};
    $upd{note}         = $args->{note}                if exists $args->{note};
    $upd{admin}        = ($args->{admin} ? 1 : 0)        if exists $args->{admin};
    $upd{port_control} = ($args->{port_control} ? 1 : 0) if exists $args->{port_control};
    $upd{active}       = ($args->{active} ? 1 : 0)       if exists $args->{active};
    # a non-empty password resets it; explicit null/empty leaves it untouched
    $upd{password} = passphrase($args->{password})->generate
        if defined $args->{password} and length $args->{password};

    $u->update(\%upd) if keys %upd;
    return to_json { user => _user_public($u) };
};

swagger_path {
    description => 'Delete a local user',
    tags        => ['admin'],
    parameters  => [{ name => 'username', in => 'path', type => 'string', required => 1 }],
    responses   => { default => {} },
},
del '/api/admin/users/:username' => require_role admin => sub {
    content_type 'application/json';
    # The built-in admin is a recovery account — it can be disabled, never deleted.
    if (lc(param('username')) eq 'admin') {
        status 403;
        return to_json { error => 'the built-in admin account cannot be deleted — disable it instead' };
    }
    my $u = schema('netdisco')->resultset('User')->find(param('username'));
    unless ($u) { status 404; return to_json { error => 'user not found' } }
    $u->delete; # cascades to api_key rows via FK
    return to_json { deleted => param('username') };
};

# ---- Static API keys -------------------------------------------------------

sub _key_public {
    my $k = shift;
    return {
        id        => $k->id + 0,
        label     => ($k->label // ''),
        username  => $k->username,
        token     => $k->token,
        active    => ($k->active ? \1 : \0),
        created   => $k->created,
        last_used => $k->last_used,
    };
}

swagger_path {
    description => 'List static API keys',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/api-keys' => require_role admin => sub {
    content_type 'application/json';
    my @rows = schema('netdisco')->resultset('ApiKey')
        ->search(undef, { order_by => { -desc => 'id' } })->all;
    return to_json { keys => [ map { _key_public($_) } @rows ] };
};

swagger_path {
    description => 'Create a static API key for a user',
    tags        => ['admin'],
    responses   => { default => {} },
},
post '/api/admin/api-keys' => require_role admin => sub {
    content_type 'application/json';
    my $args; eval { $args = decode_json(request->body || '{}'); 1 }
        or do { status 400; return to_json { error => 'invalid JSON' } };

    my $username = $args->{username} // '';
    unless (length $username) { status 400; return to_json { error => 'username required' } }
    unless (schema('netdisco')->resultset('User')->find($username)) {
        status 400; return to_json { error => 'unknown user' };
    }

    my $k = schema('netdisco')->resultset('ApiKey')->create({
        label    => $args->{label},
        username => $username,
        active   => 1,
        token    => \q{md5(random()::text) || md5(random()::text)},
    });
    $k->discard_changes; # fetch the DB-generated token
    status 201;
    return to_json { key => _key_public($k) };
};

swagger_path {
    description => 'Enable/disable or relabel a static API key',
    tags        => ['admin'],
    parameters  => [{ name => 'id', in => 'path', type => 'integer', required => 1 }],
    responses   => { default => {} },
},
put '/api/admin/api-keys/:id' => require_role admin => sub {
    content_type 'application/json';
    my $k = schema('netdisco')->resultset('ApiKey')->find(param('id'));
    unless ($k) { status 404; return to_json { error => 'key not found' } }

    my $args; eval { $args = decode_json(request->body || '{}'); 1 }
        or do { status 400; return to_json { error => 'invalid JSON' } };

    my %upd;
    $upd{active} = ($args->{active} ? 1 : 0) if exists $args->{active};
    $upd{label}  = $args->{label}            if exists $args->{label};
    $k->update(\%upd) if keys %upd;
    return to_json { key => _key_public($k) };
};

swagger_path {
    description => 'Revoke (delete) a static API key',
    tags        => ['admin'],
    parameters  => [{ name => 'id', in => 'path', type => 'integer', required => 1 }],
    responses   => { default => {} },
},
del '/api/admin/api-keys/:id' => require_role admin => sub {
    content_type 'application/json';
    my $k = schema('netdisco')->resultset('ApiKey')->find(param('id'));
    unless ($k) { status 404; return to_json { error => 'key not found' } }
    $k->delete;
    return to_json { deleted => param('id') + 0 };
};

# ---- Authentication enforcement toggle -------------------------------------
# Exposes the `no_auth` setting (inverted) as a runtime switch via setting_override
# so admins can turn auth on/off from the UI without editing config. When auth is
# required, the API needs a key or session and the UI needs login/SSO; when off,
# everything is open. The built-in admin account guarantees a way back in.

swagger_path {
    description => 'Get whether authentication is required (login / API key / SSO)',
    tags        => ['admin'],
    responses   => { default => {} },
},
get '/api/admin/settings/auth' => require_role admin => sub {
    content_type 'application/json';
    return to_json { auth_required => (setting('no_auth') ? \0 : \1) };
};

swagger_path {
    description => 'Enable or disable authentication enforcement',
    tags        => ['admin'],
    responses   => { default => {} },
},
put '/api/admin/settings/auth' => require_role admin => sub {
    content_type 'application/json';
    my $args; eval { $args = decode_json(request->body || '{}'); 1 }
        or do { status 400; return to_json { error => 'invalid JSON' } };
    my $required = $args->{auth_required} ? 1 : 0;
    # auth required  => no_auth false; auth disabled => no_auth true
    set_override('no_auth', ($required ? JSON::PP::false : JSON::PP::true),
                 session('logged_in_user'));
    return to_json { auth_required => ($required ? \1 : \0) };
};

1;
