package App::Crawler::Worker::Plugin::Graph;

use Dancer ':syntax';
use App::Crawler::Worker::Plugin;
use aliased 'App::Crawler::Worker::Status';

use App::Crawler::Util::Graph ();

register_worker({ phase => 'main' }, sub {
  App::Crawler::Util::Graph::graph();
  return Status->done('Generated graph data');
});

true;
