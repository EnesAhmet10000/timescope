/**
 * Local endpoint for the optional browser extension.
 *
 * Security posture:
 *  - Binds to 127.0.0.1 only — never reachable from the network.
 *  - Only runs while "track websites" is enabled in settings.
 *  - Requires a bearer token (shown in Settings, entered once in the
 *    extension options page).
 *  - Accepts only domain + timestamps; anything else is rejected. Full URLs
 *    are never accepted, stored, or logged.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import type { Db } from './db';
import type { Catalog } from './catalog';
import type { SettingsStore } from './settings';

interface WebBeat {
  domain: string;
  startTs: number;
  endTs: number;
}

const MAX_BODY_BYTES = 64 * 1024;
const MERGE_GAP_MS = 15_000;

export class ExtensionServer {
  private server: http.Server | null = null;

  constructor(
    private db: Db,
    private catalog: Catalog,
    private settings: SettingsStore,
  ) {}

  /** Start/stop the server to match current settings. Safe to call repeatedly. */
  sync(): void {
    const s = this.settings.get();
    if (s.trackWebsites && !s.trackingPaused && !this.server) this.start();
    else if ((!s.trackWebsites || s.trackingPaused) && this.server) this.stop();
  }

  private start(): void {
    const s = this.settings.get();
    const server = http.createServer((req, res) => this.handle(req, res));
    server.on('error', (err) => {
      console.error('[extension-server] error:', err.message);
      this.server = null;
    });
    server.listen(s.extensionPort, '127.0.0.1', () => {
      console.log(`[extension-server] listening on 127.0.0.1:${s.extensionPort}`);
    });
    this.server = server;
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }

  private authorized(req: http.IncomingMessage): boolean {
    const token = this.settings.get().extensionToken;
    const header = req.headers.authorization ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || provided.length !== token.length) return false;
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token));
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    // CORS for the extension's service worker; token is still required.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (req.method === 'GET' && req.url === '/api/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ app: 'timescope', ok: true, authorized: this.authorized(req) }));
      return;
    }
    if (req.method !== 'POST' || req.url !== '/api/web-activity') {
      res.writeHead(404).end();
      return;
    }
    if (!this.authorized(req)) {
      res.writeHead(401).end();
      return;
    }

    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413).end();
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const beats = this.parseBeats(Buffer.concat(chunks).toString('utf8'));
        const accepted = this.record(beats);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accepted }));
      } catch {
        res.writeHead(400).end();
      }
    });
  }

  private parseBeats(body: string): WebBeat[] {
    const parsed: unknown = JSON.parse(body);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const now = Date.now();
    const out: WebBeat[] = [];
    for (const item of list.slice(0, 200)) {
      if (typeof item !== 'object' || item === null) continue;
      const o = item as Record<string, unknown>;
      const domain = normalizeDomain(o.domain);
      const startTs = typeof o.startTs === 'number' ? Math.round(o.startTs) : NaN;
      const endTs = typeof o.endTs === 'number' ? Math.round(o.endTs) : NaN;
      if (!domain || !Number.isFinite(startTs) || !Number.isFinite(endTs)) continue;
      if (endTs <= startTs || endTs - startTs > 6 * 3_600_000) continue; // reject absurd spans
      if (endTs > now + 60_000 || startTs < now - 7 * 86_400_000) continue; // reject far past/future
      out.push({ domain, startTs, endTs });
    }
    return out;
  }

  private record(beats: WebBeat[]): number {
    const s = this.settings.get();
    if (!s.trackWebsites || s.trackingPaused) return 0;
    let accepted = 0;
    for (const beat of beats) {
      if (s.excludedDomains.some((d) => beat.domain === d || beat.domain.endsWith('.' + d))) continue;
      const domainId = this.catalog.ensureDomain(beat.domain);
      // Merge with the previous row for the same domain when contiguous.
      const prev = this.db.get<{ id: number; end_ts: number }>(
        'SELECT id, end_ts FROM web_sessions WHERE domain_id = ? ORDER BY end_ts DESC LIMIT 1',
        [domainId],
      );
      if (prev && beat.startTs - prev.end_ts <= MERGE_GAP_MS && beat.endTs > prev.end_ts) {
        this.db.run('UPDATE web_sessions SET end_ts = ? WHERE id = ?', [beat.endTs, prev.id]);
      } else {
        this.db.run('INSERT INTO web_sessions (domain_id, start_ts, end_ts) VALUES (?, ?, ?)', [
          domainId,
          beat.startTs,
          beat.endTs,
        ]);
      }
      accepted++;
    }
    return accepted;
  }
}

export function normalizeDomain(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.trim().toLowerCase().replace(/^www\./, '');
  if (d.length === 0 || d.length > 253) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  return d;
}
