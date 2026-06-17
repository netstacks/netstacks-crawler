package App::Crawler::Worker::Plugin::Delete;

use Dancer ':syntax';
use App::Crawler::Worker::Plugin;
use aliased 'App::Crawler::Worker::Status';

use App::Crawler::Util::Device 'delete_device';

register_worker({ phase => 'check' }, sub {
  return Status->error('Missing device (-d).')
    unless shift->device;
  return Status->done('Delete is able to run');
});

register_worker({ phase => 'main' }, sub {
  my ($job, $workerconf) = @_;
  my ($device, $port) = map {$job->$_} qw/device port/;

  return Status->error('Missing device (-d).')
    unless defined $device;

  if (! $device->in_storage) {
      return Status->error(sprintf "unknown device: %s.", $device);
  }

  # Defence against the alias-rewrite in get_device(): if the user asked to
  # delete device X but get_device resolved that IP to a DIFFERENT device Y
  # (because X is a secondary/management alias on Y in device_ip), refuse.
  # Otherwise a click on Delete for one device silently deletes another.
  if (defined $job->requested_device) {
      (my $requested = "@{[ $job->requested_device ]}") =~ s{/\d+$}{};
      my $resolved = "@{[ $device->ip ]}";
      $resolved =~ s{/\d+$}{};
      if (lc $requested ne lc $resolved) {
          return Status->error(sprintf
              "Refusing to delete %s: requested IP %s resolves to a different device (%s is a secondary alias). Delete via the primary IP %s instead.",
              $resolved, $requested, $requested, $resolved);
      }
  }

  # support for Hooks
  vars->{'hook_data'} = { $device->get_columns };
  delete vars->{'hook_data'}->{'snmp_comm'}; # for privacy

  $port = ($port ? 1 : 0);
  my $happy = delete_device($device, $port);

  if ($happy) {
      return Status->done("Deleted device: $device")
  }
  else {
      return Status->error("Failed to delete device: $device")
  }
});

true;
