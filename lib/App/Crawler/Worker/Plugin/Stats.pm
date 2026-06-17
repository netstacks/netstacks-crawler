package App::Crawler::Worker::Plugin::Stats;

use Dancer ':syntax';
use App::Crawler::Worker::Plugin;
use aliased 'App::Crawler::Worker::Status';

use App::Crawler::Util::Statistics ();

register_worker({ phase => 'main' }, sub {
  App::Crawler::Util::Statistics::update_stats();
  return Status->done('Updated statistics');
});

true;
