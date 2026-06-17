import axios from 'axios';

// Dev-only: in production, ALB / oauth2-proxy sets X-Remote-User. Vite dev has
// no perimeter, so we inject a header so the crawler's trust_x_remote_user
// config can attribute the request to a user. import.meta.env.DEV is true only
// when running `vite dev`, so production builds NEVER send this header.
const DEV_REMOTE_USER = import.meta.env.DEV
  ? ((import.meta.env.VITE_DEV_REMOTE_USER as string | undefined) ?? 'crawler-user')
  : null;

export const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  // Send the session cookie so a local (username/password) login authenticates
  // subsequent /api/* calls. Header/key auth is unaffected.
  withCredentials: true,
});

// Request interceptor: most reliable way to add a header to every request,
// across axios versions. Applied to both our `api` instance and the bare
// axios global (meta.ts uses axios directly for /health, /info, /version).
if (DEV_REMOTE_USER) {
  const addHeader = (config: { headers?: Record<string, string> }) => {
    config.headers = config.headers ?? {};
    config.headers['X-Remote-User'] = DEV_REMOTE_USER;
    return config;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  api.interceptors.request.use(addHeader as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  axios.interceptors.request.use(addHeader as any);
}

// No auth interceptor -- perimeter handles it.
// On 4xx/5xx, surface a typed error.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status ?? 0;
    const message = err.response?.data?.error ?? err.message ?? 'Request failed';
    return Promise.reject({ status, message, raw: err });
  },
);

export type ApiError = { status: number; message: string; raw: unknown };
