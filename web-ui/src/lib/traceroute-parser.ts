export interface TracerouteHop {
  hop: number;
  host: string | null;
  ip: string | null;
  latencies: number[];
  timedOut: boolean;
}

const RE_HOP_LINE = /^\s*(\d+)\s+(.+)$/;
const RE_HOST_IP = /(\S+)\s+\((\d{1,3}(?:\.\d{1,3}){3})\)/;
const RE_BARE_IP = /(\d{1,3}(?:\.\d{1,3}){3})/;
const RE_LATENCY = /([\d.]+)\s*ms/g;
const RE_STAR = /\*\s*\*\s*\*/;

export function parseTraceroute(raw: string): TracerouteHop[] {
  const lines = raw.split('\n').filter((l) => l.trim());
  const hops: TracerouteHop[] = [];

  for (const line of lines) {
    const hopMatch = RE_HOP_LINE.exec(line);
    if (!hopMatch) continue;

    const hopNum = hopMatch[1] ?? '0';
    const rest = hopMatch[2] ?? '';
    const hop = parseInt(hopNum, 10);

    if (RE_STAR.test(rest)) {
      hops.push({ hop, host: null, ip: null, latencies: [], timedOut: true });
      continue;
    }

    let host: string | null = null;
    let ip: string | null = null;

    const hostIpMatch = RE_HOST_IP.exec(rest);
    if (hostIpMatch) {
      host = hostIpMatch[1] ?? null;
      ip = hostIpMatch[2] ?? null;
    } else {
      const bareIpMatch = RE_BARE_IP.exec(rest);
      if (bareIpMatch) ip = bareIpMatch[1] ?? null;
    }

    const latencies: number[] = [];
    let lm;
    while ((lm = RE_LATENCY.exec(rest)) !== null) {
      const val = lm[1];
      if (val) latencies.push(parseFloat(val));
    }

    if (ip || host || latencies.length > 0) {
      hops.push({ hop, host, ip, latencies, timedOut: false });
    }
  }

  return hops;
}

export function avgLatency(hop: TracerouteHop): number | null {
  if (hop.latencies.length === 0) return null;
  return hop.latencies.reduce((a, b) => a + b, 0) / hop.latencies.length;
}

export function latencyColor(ms: number): string {
  if (ms < 5) return 'text-emerald-400';
  if (ms < 20) return 'text-yellow-400';
  return 'text-red-400';
}
