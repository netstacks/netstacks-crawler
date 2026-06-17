import { describe, it, expect } from 'vitest';
import { isIPv4, isIPv6, isMAC, isCIDR, normaliseMAC, linkForCell } from './cell-link';

describe('isIPv4', () => {
  it('accepts dotted-quad', () => {
    expect(isIPv4('10.0.0.1')).toBe(true);
    expect(isIPv4('192.168.1.255')).toBe(true);
    expect(isIPv4('0.0.0.0')).toBe(true);
  });
  it('rejects garbage', () => {
    expect(isIPv4('10.0.0')).toBe(false);
    expect(isIPv4('not.an.ip')).toBe(false);
    expect(isIPv4('')).toBe(false);
  });
});

describe('isIPv6', () => {
  it('accepts colon-form', () => {
    expect(isIPv6('fe80::1')).toBe(true);
    expect(isIPv6('2001:db8::')).toBe(true);
  });
  it('rejects v4 and MACs', () => {
    expect(isIPv6('10.0.0.1')).toBe(false);
    expect(isIPv6('c8:fe:6a:45:ab:c6')).toBe(false);
  });
});

describe('isMAC', () => {
  it('accepts colon, dash, dot, bare', () => {
    expect(isMAC('c8:fe:6a:45:ab:c6')).toBe(true);
    expect(isMAC('C8-FE-6A-45-AB-C6')).toBe(true);
    expect(isMAC('c8fe.6a45.abc6')).toBe(true);
    expect(isMAC('c8fe6a45abc6')).toBe(true);
  });
  it('rejects wrong shapes', () => {
    expect(isMAC('c8:fe:6a:45:ab')).toBe(false);
    expect(isMAC('not-a-mac')).toBe(false);
    expect(isMAC('10.0.0.1')).toBe(false);
  });
});

describe('isCIDR', () => {
  it('accepts v4 CIDR', () => {
    expect(isCIDR('10.0.0.0/8')).toBe(true);
    expect(isCIDR('192.168.1.0/24')).toBe(true);
  });
  it('rejects plain IP', () => {
    expect(isCIDR('10.0.0.0')).toBe(false);
  });
});

describe('normaliseMAC', () => {
  it('canonicalises every form to lowercase colon-separated', () => {
    expect(normaliseMAC('c8:fe:6a:45:ab:c6')).toBe('c8:fe:6a:45:ab:c6');
    expect(normaliseMAC('C8-FE-6A-45-AB-C6')).toBe('c8:fe:6a:45:ab:c6');
    expect(normaliseMAC('c8fe.6a45.abc6')).toBe('c8:fe:6a:45:ab:c6');
    expect(normaliseMAC('C8FE6A45ABC6')).toBe('c8:fe:6a:45:ab:c6');
  });
  it('returns non-MAC values unchanged', () => {
    expect(normaliseMAC('not-a-mac')).toBe('not-a-mac');
  });
});

describe('linkForCell -- known field names', () => {
  it('ip → /devices/{ip}', () => {
    expect(linkForCell('ip', '10.0.0.1')).toEqual({ href: '/devices/10.0.0.1', display: 'mono' });
  });
  it('device → /devices/{ip}', () => {
    expect(linkForCell('device', '10.0.0.1')).toEqual({ href: '/devices/10.0.0.1', display: 'mono' });
  });
  it('remote_ip → /devices/{ip}', () => {
    expect(linkForCell('remote_ip', '10.0.0.1')).toEqual({ href: '/devices/10.0.0.1', display: 'mono' });
  });
  it('mac → /nodes/{mac} (normalised)', () => {
    expect(linkForCell('mac', 'C8FE6A45ABC6')).toEqual({
      href: '/nodes/c8%3Afe%3A6a%3A45%3Aab%3Ac6',
      display: 'mono',
    });
  });
  it('dns → /devices?q=', () => {
    expect(linkForCell('dns', 'sw1.example.com')).toEqual({
      href: '/devices?q=sw1.example.com',
    });
  });
  it('vlan → /reports/VLAN/vlaninventory', () => {
    expect(linkForCell('vlan', '100')).toEqual({
      href: '/reports/VLAN/vlaninventory?vlan=100',
    });
  });
  it('subnet (CIDR) → /reports/IP/subnets', () => {
    expect(linkForCell('subnet', '192.168.1.0/24')).toEqual({
      href: '/reports/IP/subnets?net=192.168.1.0%2F24',
      display: 'mono',
    });
  });
  it('job (integer) → /admin/jobs?id=', () => {
    expect(linkForCell('job', '42')).toEqual({ href: '/admin/jobs?id=42' });
  });
  it('port without ctx returns null', () => {
    expect(linkForCell('port', 'Ethernet1/1')).toBeNull();
  });
  it('port with ctx.device → device deep-link', () => {
    expect(linkForCell('port', 'Ethernet1/1', { device: '10.0.0.1' })).toEqual({
      href: '/devices/10.0.0.1/ports#Ethernet1%2F1',
      display: 'mono',
    });
  });
});

describe('linkForCell -- content fallback', () => {
  it('unknown field, IP content → /devices', () => {
    expect(linkForCell('value', '10.0.0.1')).toEqual({
      href: '/devices/10.0.0.1',
      display: 'mono',
    });
  });
  it('unknown field, MAC content → /nodes', () => {
    expect(linkForCell('value', 'c8:fe:6a:45:ab:c6')).toEqual({
      href: '/nodes/c8%3Afe%3A6a%3A45%3Aab%3Ac6',
      display: 'mono',
    });
  });
  it('unknown field, CIDR content → /reports/IP/subnets', () => {
    expect(linkForCell('value', '10.0.0.0/8')).toEqual({
      href: '/reports/IP/subnets?net=10.0.0.0%2F8',
      display: 'mono',
    });
  });
  it('unrecognised content → null', () => {
    expect(linkForCell('value', 'nothing-special')).toBeNull();
  });
});

describe('linkForCell -- edge cases', () => {
  it('null/undefined returns null', () => {
    expect(linkForCell('ip', null)).toBeNull();
    expect(linkForCell('ip', undefined)).toBeNull();
  });
  it('empty string returns null', () => {
    expect(linkForCell('ip', '')).toBeNull();
    expect(linkForCell('ip', '   ')).toBeNull();
  });
  it('field name is case-insensitive', () => {
    expect(linkForCell('IP', '10.0.0.1')).toEqual({ href: '/devices/10.0.0.1', display: 'mono' });
  });
});
