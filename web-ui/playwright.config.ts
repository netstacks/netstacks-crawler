import { defineConfig } from '@playwright/test';

// E2E target is the docker-compose stack at http://localhost:5000 by default
// — the SPA bundle is served by the Perl `web` container, and the JSON API
// is the same backend behind /api/*. In a real deployment ALB / oauth2-proxy
// injects X-Remote-User; for tests we inject it directly.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5000',
    trace: 'retain-on-failure',
    extraHTTPHeaders: {
      'X-Remote-User': process.env.E2E_REMOTE_USER ?? 'crawler-user',
    },
  },
});
