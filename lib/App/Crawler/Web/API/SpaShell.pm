package App::Crawler::Web::API::SpaShell;
use strict;
use warnings;

use Dancer ':syntax';
use File::Spec;

sub _ui_dir {
    File::Spec->catdir(setting('appdir'), 'public', 'ui');
}

sub _serve_index {
    content_type 'text/html; charset=utf-8';
    my $user = request->header('X-Remote-User') // '';
    $user =~ s/[<>"]//g;
    my $meta = $user ? qq{<meta name="x-remote-user" content="$user">} : '';

    my $index = File::Spec->catfile(_ui_dir(), 'index.html');
    if (-e $index) {
        open my $fh, '<:encoding(UTF-8)', $index or do { status 500; return 'index read failed' };
        local $/; my $html = <$fh>; close $fh;
        $html =~ s{</head>}{$meta</head>}i if $meta;
        return $html;
    }
    my $app_name = setting('application_name') || 'NetStacks Crawler';
    return <<HTML;
<!DOCTYPE html>
<html><head><title>$app_name</title>$meta</head>
<body style="font-family:system-ui;padding:40px;background:#1e1e1e;color:#ccc">
  <h1>$app_name</h1>
  <p>SPA bundle not present in this image. See <a style="color:#4fc1ff" href="/swagger-ui">/swagger-ui</a>.</p>
  <p>Service info: <a style="color:#4fc1ff" href="/info">/info</a></p>
</body></html>
HTML
}

get '/' => \&_serve_index;

# Any unknown non-API path falls back to SPA so client-side routes work
# (e.g. /devices/10.0.0.1/ports loaded by browser refresh).
get qr{^/(?!api/|swagger|health|metrics|info|login|logout|assets/).+$} => \&_serve_index;

get '/assets/:filename' => sub {
    my $fn = param('filename');
    $fn =~ s{[^A-Za-z0-9._-]}{}g;
    my $path = File::Spec->catfile(_ui_dir(), 'assets', $fn);
    unless (-e $path) { status 404; return '' }
    my %types = (
        '.js'    => 'application/javascript',
        '.css'   => 'text/css',
        '.svg'   => 'image/svg+xml',
        '.png'   => 'image/png',
        '.woff2' => 'font/woff2',
        '.map'   => 'application/json',
    );
    my ($ext) = $fn =~ /(\.[^.]+)$/;
    my $ct = $types{ $ext // '' } || 'application/octet-stream';
    # Bypass Dancer's charset re-encoding for binary and text assets by
    # using send_file — it sends raw bytes directly, no double-encoding.
    send_file $path, content_type => $ct, system_path => 1;
};

1;
