package App::Crawler::Worker::Plugin::Psql;

use Dancer ':syntax';
use App::Crawler::Worker::Plugin;
use aliased 'App::Crawler::Worker::Status';

register_worker({ phase => 'main' }, sub {
  my ($job, $workerconf) = @_;
  my $extra = $job->extra;

  if ($extra) {
      system('psql', '-c', $extra);
  }
  else {
      system('psql');
  }

  return Status->done('psql session closed.');
});

true;
