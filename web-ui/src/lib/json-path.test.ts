import { describe, it, expect } from 'vitest';
import { extractByPath, toHostIp, extractHostIps } from './json-path';

describe('extractByPath', () => {
  it('spreads a nested array and reads a deep leaf (NetBox shape)', () => {
    const data = {
      results: [
        { name: 'a', primary_ip: { address: '10.0.0.1/32' } },
        { name: 'b', primary_ip: { address: '10.0.0.2/24' } },
      ],
    };
    expect(extractByPath(data, 'results[].primary_ip.address')).toEqual(['10.0.0.1/32', '10.0.0.2/24']);
  });

  it('handles a bare-array root', () => {
    expect(extractByPath(['10.0.0.1', '10.0.0.2'], '[]')).toEqual(['10.0.0.1', '10.0.0.2']);
  });

  it('spreads an array of scalars under a key', () => {
    expect(extractByPath({ addresses: ['10.1.1.1', '10.1.1.2'] }, 'addresses[]')).toEqual(['10.1.1.1', '10.1.1.2']);
  });

  it('drops missing keys / null leaves without throwing', () => {
    const data = { results: [{ primary_ip: { address: '10.0.0.1' } }, { primary_ip: null }, {}] };
    expect(extractByPath(data, 'results[].primary_ip.address')).toEqual(['10.0.0.1']);
  });

  it('returns nothing when an array was expected but absent', () => {
    expect(extractByPath({ results: 'nope' }, 'results[].x')).toEqual([]);
  });

  it('coerces non-string leaves to strings', () => {
    expect(extractByPath({ ids: [1, 2, 3] }, 'ids[]')).toEqual(['1', '2', '3']);
  });
});

describe('toHostIp', () => {
  it('strips a CIDR mask', () => {
    expect(toHostIp('10.0.0.1/32')).toBe('10.0.0.1');
    expect(toHostIp('192.168.1.5/24')).toBe('192.168.1.5');
  });
  it('passes a bare IP', () => {
    expect(toHostIp('10.0.0.1')).toBe('10.0.0.1');
  });
  it('accepts IPv6', () => {
    expect(toHostIp('2001:db8::1/128')).toBe('2001:db8::1');
  });
  it('rejects non-IPs', () => {
    expect(toHostIp('not-an-ip')).toBeNull();
    expect(toHostIp('')).toBeNull();
    expect(toHostIp('example.com')).toBeNull();
  });
});

describe('extractHostIps', () => {
  it('extracts, normalises, dedupes and counts drops', () => {
    const data = {
      results: [
        { primary_ip: { address: '10.0.0.1/32' } },
        { primary_ip: { address: '10.0.0.1/32' } }, // dup
        { primary_ip: { address: '10.0.0.2/24' } },
        { primary_ip: { address: 'bogus' } },        // dropped
        { primary_ip: null },                          // not extracted at all
      ],
    };
    expect(extractHostIps(data, 'results[].primary_ip.address')).toEqual({ ips: ['10.0.0.1', '10.0.0.2'], dropped: 1 });
  });
});
