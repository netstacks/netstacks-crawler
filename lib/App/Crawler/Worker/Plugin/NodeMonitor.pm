package App::Crawler::Worker::Plugin::NodeMonitor;

use Dancer ':syntax';
use App::Crawler::Worker::Plugin;
use aliased 'App::Crawler::Worker::Status';

use App::Crawler::Util::NodeMonitor ();

register_worker({ phase => 'main' }, sub {
  App::Crawler::Util::NodeMonitor::monitor();
  return Status->done('Generated monitor data');
});

true;
