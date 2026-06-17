package App::Crawler::Worker::Plugin::Macsuck::PortAccessEntity;

use Dancer ':syntax';
use App::Crawler::Worker::Plugin;
use aliased 'App::Crawler::Worker::Status';
use Dancer::Plugin::DBIC 'schema';

use App::Crawler::Util::PortAccessEntity qw/update_pae_attributes/;

register_worker({ phase => 'main', driver => 'snmp' }, sub {
  my ($job, $workerconf) = @_;
  my $device = $job->device;

  return update_pae_attributes($device)
});

true;
