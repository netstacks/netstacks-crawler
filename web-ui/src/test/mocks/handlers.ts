import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import device from './fixtures/device.json';
import ports from './fixtures/ports.json';
import nodes from './fixtures/nodes.json';
import vlans from './fixtures/vlans.json';
import modules from './fixtures/modules.json';
import log from './fixtures/log.json';

export const handlers = [
  http.get('/api/devices', () => HttpResponse.json({ devices: [device], total: 1, page: 1, page_size: 50 })),
  http.get('/api/device/:ip', () => HttpResponse.json(device)),
  http.get('/api/device/:ip/details', () => HttpResponse.json({ ...device, counts: { ports: 8, nodes: 3, vlans: 2, modules: 4 } })),
  http.get('/api/device/:ip/ports', () => HttpResponse.json({ ports })),
  http.get('/api/device/:ip/nodes', () => HttpResponse.json({ nodes })),
  http.get('/api/device/:ip/vlans', () => HttpResponse.json({ vlans })),
  http.get('/api/device/:ip/modules', () => HttpResponse.json({ modules })),
  http.get('/api/device/:ip/log', () => HttpResponse.json({ log })),
  http.post('/api/portcontrol', () => HttpResponse.json({ job_id: 42 })),
  http.get('/api/job/:id', () => HttpResponse.json({ job: 42, status: 'done' })),
  http.get('/health', () => HttpResponse.json({ status: 'ok', db: 'ok', workers: 84, backends: 3 })),
  http.get('/api/version', () => HttpResponse.json({ crawler_version: '2.099000', schema_version: '96', features: { web_ui: 0 } })),
];

export const server = setupServer(...handlers);
