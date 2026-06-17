import { describe, it, expect } from 'vitest';
import { adaptRows } from './table';

// The /stats/operational payload is an object of several arrays. Because the
// backend serializes a Perl hash (non-deterministic key order), a panel must
// select its dataset explicitly via `field` — never by "first array wins".
const operational = {
  slow_devices: [{ ip: '10.0.0.1', secs: 30 }],
  timed_out_devices: [{ ip: '10.0.0.2' }],
  undiscovered_neighbors: [{ ip: '10.0.0.3' }],
  job_queue: { queued: 1 },
};

describe('adaptRows', () => {
  it('selects the named field when provided', () => {
    expect(adaptRows(operational, 'slow_devices')).toEqual([{ ip: '10.0.0.1', secs: 30 }]);
    expect(adaptRows(operational, 'timed_out_devices')).toEqual([{ ip: '10.0.0.2' }]);
  });

  it('returns [] when the named field is missing or not an array', () => {
    expect(adaptRows(operational, 'nope')).toEqual([]);
    expect(adaptRows(operational, 'job_queue')).toEqual([]);
  });

  it('passes arrays through', () => {
    expect(adaptRows([{ a: 1 }])).toEqual([{ a: 1 }]);
  });

  it('unwraps rows/jobs wrappers', () => {
    expect(adaptRows({ rows: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(adaptRows({ jobs: [{ j: 1 }] })).toEqual([{ j: 1 }]);
  });

  it('falls back to first array only without a field', () => {
    expect(adaptRows({ x: 'n', items: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });
});
