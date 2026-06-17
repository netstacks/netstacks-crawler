import { describe, it, expect } from 'vitest';
import * as devices from '@/api/devices';
import * as nodes from '@/api/nodes';
import * as meta from '@/api/meta';

const SKIP = !process.env.E2E_BASE_URL;

describe.skipIf(SKIP)('API contract against live stack', () => {
  it('listDevices returns parsed response', async () => {
    const r = await devices.listDevices({ page: 1, page_size: 1 });
    expect(r.devices).toBeInstanceOf(Array);
    expect(r.total).toBeTypeOf('number');
  });
  it('getDevice fixture parses', async () => {
    const r = await devices.getDevice('10.0.0.1');
    expect(r.ip).toBe('10.0.0.1');
  });
  it('getDevicePorts parses', async () => {
    const r = await devices.getDevicePorts('10.0.0.1');
    expect(r.length).toBeGreaterThan(0);
  });
  it('getHealth parses', async () => {
    const r = await meta.getHealth();
    expect(r.status).toBe('ok');
  });
  it('getNode handles missing gracefully (404)', async () => {
    await expect(nodes.getNode('aaaaaaaaaaaa')).rejects.toMatchObject({ status: 404 });
  });
});
