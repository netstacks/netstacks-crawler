package TestApp;

use strict;
use warnings;

use FindBin;
use Path::Class;

BEGIN {
    # Find the project root (contains share/ directory)
    my $test_dir = dir($FindBin::RealBin);
    my $project_root = $test_dir;
    while ($project_root && !-d $project_root->subdir('share')) {
        my $parent = $project_root->parent;
        last if $parent eq $project_root;  # reached filesystem root
        $project_root = $parent;
    }

    my $t_dir = $project_root->subdir('t');

    unshift @INC,
        $project_root->subdir('lib')->stringify,
        $t_dir->subdir('lib')->stringify;

    $ENV{DANCER_CONFDIR}    //= $project_root->subdir('share')->stringify;
    $ENV{DANCER_ENVDIR}     = $t_dir->subdir('environments')->stringify;
    $ENV{DANCER_ENVIRONMENT} = 'test';
}

use Exporter 'import';
our @EXPORT_OK = qw(psgi_app);

sub psgi_app {
    require App::Crawler;
    require Dancer;
    require App::Crawler::Web;
    return Dancer::dance();
}

1;
