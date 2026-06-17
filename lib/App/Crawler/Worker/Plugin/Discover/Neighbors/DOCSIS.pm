package App::Crawler::Worker::Plugin::Discover::Neighbors::DOCSIS;
use Dancer ':syntax';

use App::Crawler::Worker::Plugin;
use App::Crawler::Transport::SNMP;
use aliased 'App::Crawler::Worker::Status';

use App::Crawler::Util::Device qw/get_device is_discoverable/;
use App::Crawler::Util::Permission 'acl_matches';
use App::Crawler::JobQueue 'jq_insert';

register_worker({ phase => 'main', driver => 'snmp' }, sub {
  my ($job, $workerconf) = @_;

  my $device = $job->device;
  return unless $device->in_storage;

  if (acl_matches($device, 'skip_neighbors') or not setting('discover_neighbors')) {
      return Status->info(
        sprintf ' [%s] neigh - DOCSIS modems discovery is disabled on this device',
        $device->ip);
  }

  my $snmp = App::Crawler::Transport::SNMP->reader_for($device)
    or return Status->defer("discover failed: could not SNMP connect to $device");

  my $modems = $snmp->docs_if_cmts_cm_status_inet_address() || {};

  return Status->info(" [$device] neigh - no modems (probably not a DOCSIS device)")
    unless (scalar values %$modems);

  my $count = 0;
  foreach my $ip (values %$modems) { 

    # Some modems may be registered, but not have an IP assigned (they could be offline, disabled, etc)
    next if $ip eq '';

    my $peer = get_device($ip);
    next if $peer->in_storage or not is_discoverable($peer);
    next if vars->{'queued'}->{$ip};

    jq_insert({
      device => $ip,
      action => 'discover',
    });

    $count++;
    vars->{'queued'}->{$ip} += 1;
    debug sprintf ' [%s] queue - queued %s for discovery (DOCSIS peer)', $device, $ip;
  }

  return Status->info(" [$device] neigh - $count DOCSIS peers (modems) added to queue.");
});

true;
