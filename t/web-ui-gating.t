#!/usr/bin/env perl
use strict;
use warnings;
use FindBin;
use lib "$FindBin::Bin/lib";
use TestApp qw(psgi_app);
use Test::More;
use Plack::Test;
use HTTP::Request::Common;

# default config: web_ui.enabled = false
my $app  = psgi_app();
my $test = Plack::Test->create($app);

subtest 'Non-API paths serve SPA shell when UI off' => sub {
    for my $path (qw(/inventory /search /device /admin/jobqueue)) {
        my $res = $test->request(GET $path);
        is $res->code, 200, "$path returns 200 (SPA shell) when UI off";
        like $res->content_type, qr{text/html}, "$path is html";
    }
};

subtest 'API-side routes remain reachable' => sub {
    for my $path (qw(/health /metrics /swagger.json)) {
        my $res = $test->request(GET $path);
        isnt $res->code, 404, "$path is still served (got " . $res->code . ")";
    }
};

subtest 'UI-kind plugins skipped when UI off' => sub {
    # Configure a fake ui-only plugin via in-memory setting.
    # We expect _load_web_plugins to refuse to load it.
    my @loaded;
    no warnings 'redefine';
    local *App::Crawler::Web::_actually_load_plugin = sub { push @loaded, $_[0]; };

    App::Crawler::Web::_load_web_plugins([
        { name => 'FakeApi', kind => 'api' },
        { name => 'FakeUi',  kind => 'ui'  },
        { name => 'FakeBoth', kind => 'both' },
        'LegacyStringName',   # backward compat: no kind => assume both
    ]);

    is_deeply [sort @loaded],
              [sort qw(App::Crawler::Web::Plugin::FakeApi
                        App::Crawler::Web::Plugin::FakeBoth
                        App::Crawler::Web::Plugin::LegacyStringName)],
              'only api and both plugins load when UI off';
};

done_testing;
