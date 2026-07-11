import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExtensionServer } from '../src/main/webserver';
import { makeCtx, type TestCtx } from './helpers';

const PORT = 49321;

describe('ExtensionServer', () => {
  let ctx: TestCtx;
  let server: ExtensionServer;
  let token: string;

  beforeEach(async () => {
    ctx = makeCtx();
    ctx.settings.update({ trackWebsites: true, extensionPort: PORT, excludedDomains: ['mybank.com'] });
    token = ctx.settings.get().extensionToken;
    server = new ExtensionServer(ctx.db, ctx.catalog, ctx.settings);
    server.sync();
    await new Promise((r) => setTimeout(r, 150)); // let it bind
  });

  afterEach(() => {
    server.stop();
  });

  const post = (body: unknown, auth?: string) =>
    fetch(`http://127.0.0.1:${PORT}/api/web-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
    });

  it('rejects requests without a valid token', async () => {
    const now = Date.now();
    const beat = { domain: 'youtube.com', startTs: now - 10_000, endTs: now };
    expect((await post([beat])).status).toBe(401);
    expect((await post([beat], 'wrong-token')).status).toBe(401);
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM web_sessions')?.n).toBe(0);
  });

  it('accepts valid beats and stores domain sessions', async () => {
    const now = Date.now();
    const res = await post([{ domain: 'www.YouTube.com', startTs: now - 10_000, endTs: now }], token);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { accepted: number }).accepted).toBe(1);
    const rows = ctx.db.all<{ domain: string }>(
      'SELECT d.domain FROM web_sessions w JOIN domains d ON d.id = w.domain_id',
    );
    expect(rows).toEqual([{ domain: 'youtube.com' }]);
  });

  it('merges contiguous beats for the same domain into one row', async () => {
    const now = Date.now();
    await post([{ domain: 'github.com', startTs: now - 60_000, endTs: now - 30_000 }], token);
    await post([{ domain: 'github.com', startTs: now - 29_000, endTs: now }], token);
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM web_sessions')?.n).toBe(1);
  });

  it('drops excluded domains and malformed beats', async () => {
    const now = Date.now();
    const res = await post(
      [
        { domain: 'mybank.com', startTs: now - 5000, endTs: now }, // excluded
        { domain: 'sub.mybank.com', startTs: now - 5000, endTs: now }, // excluded subdomain
        { domain: 'http://evil.com/x', startTs: now - 5000, endTs: now }, // not a domain
        { domain: 'ok.example.com', startTs: now, endTs: now - 5000 }, // end before start
        { domain: 'ok.example.com' }, // missing timestamps
      ],
      token,
    );
    expect(((await res.json()) as { accepted: number }).accepted).toBe(0);
    expect(ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM web_sessions')?.n).toBe(0);
  });

  it('ping reports authorization state', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await res.json()) as object).toMatchObject({ app: 'timescope', ok: true, authorized: true });
  });
});
