import { describe, it, expect } from 'vitest';
import { humanizeLabel, formatValue, decodeLayers, formatUptime, isEmptyValue } from './format';

describe('humanizeLabel', () => {
  it('uppercases known acronyms', () => {
    expect(humanizeLabel('ip')).toBe('IP');
    expect(humanizeLabel('snmp_class')).toBe('SNMP Class');
    expect(humanizeLabel('mac')).toBe('MAC');
  });
  it('uses overrides', () => {
    expect(humanizeLabel('os_ver')).toBe('OS Version');
    expect(humanizeLabel('pae_is_enabled')).toBe('802.1X Enabled');
  });
  it('title-cases plain words', () => {
    expect(humanizeLabel('serial')).toBe('Serial');
    expect(humanizeLabel('remote_model')).toBe('Neighbor Model');
  });
});

describe('decodeLayers', () => {
  it('decodes the sysServices bitmask to OSI layers', () => {
    expect(decodeLayers('00000110')).toBe('L2, L3'); // typical L2/L3 switch-router
    expect(decodeLayers('00000100')).toBe('L3');
  });
  it('passes through non-binary input', () => {
    expect(decodeLayers('')).toBe('--');
  });
});

describe('formatUptime', () => {
  it('formats TimeTicks (hundredths of a second)', () => {
    expect(formatUptime(8640000 * 2)).toBe('2d 0h'); // 2 days
    expect(formatUptime(360000)).toBe('1h 0m');       // 1 hour
    expect(formatUptime(0)).toBe('--');
  });
});

describe('formatValue', () => {
  it('renders booleans as Yes/No', () => {
    expect(formatValue('is_pseudo', true)).toBe('Yes');
    expect(formatValue('is_pseudo', false)).toBe('No');
  });
  it('blank for null/empty', () => {
    expect(formatValue('whatever', null)).toBe('--');
    expect(formatValue('whatever', '')).toBe('--');
  });
  it('formats uptime and layers by key', () => {
    expect(formatValue('uptime', 360000)).toBe('1h 0m');
    expect(formatValue('layers', '00000110')).toBe('L2, L3');
  });
  it('passes through plain scalars', () => {
    expect(formatValue('model', 'QFX5120')).toBe('QFX5120');
  });
});

describe('isEmptyValue', () => {
  it('treats null/empty/[]/{} as empty', () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue({})).toBe(true);
    expect(isEmptyValue('x')).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
  });
});
