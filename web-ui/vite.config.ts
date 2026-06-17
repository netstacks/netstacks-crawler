import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: process.env.SPA_BUILD_DEST ?? '../share/public/ui',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: (() => {
      // In production, ALB / oauth2-proxy injects X-Remote-User. In Vite dev,
      // we simulate that so the trust_x_remote_user crawler config has a user
      // to attribute requests to.
      const devUser = process.env.DEV_REMOTE_USER ?? 'crawler-user';
      const target  = process.env.DEV_API_URL    ?? 'http://localhost:5000';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: any = {
        target,
        changeOrigin: true,
        configure: (proxy: { on: (e: string, fn: (req: { setHeader: (k: string, v: string) => void }) => void) => void }) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Remote-User', devUser);
          });
        },
      };
      return {
        '/api':          opts,
        '/health':       opts,
        '/metrics':      opts,
        '/info':         opts,
        '/swagger.json': opts,
        '/swagger-ui':   opts,
      };
    })(),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Only collect Vitest specs under src/. Playwright e2e specs live at
    // tests/e2e/ and use @playwright/test which is incompatible with Vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'tests/e2e/**', 'dist'],
  },
});
