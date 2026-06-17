package App::Crawler::Builder;

use strict;
use warnings;

use File::Spec; # core
use Module::Build;
@App::Crawler::Builder::ISA = qw(Module::Build);

sub ACTION_python {
    my $self = shift;
    require App::Crawler::Util::Python;
    $self->do_system( App::Crawler::Util::Python::py_install() );
}

sub ACTION_install {
    my $self = shift;
    $self->SUPER::ACTION_install;
    $self->ACTION_python;
}

1;
