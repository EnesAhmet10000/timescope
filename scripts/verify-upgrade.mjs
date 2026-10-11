/** Verify an OFFLINE backup on an isolated copy; never opens the input for writing. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const source = process.argv[2];
if (!source) throw new Error('Provide the path to a stopped/offline database backup, not a live database.');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timescope-upgrade-verification-'));
const copy = path.join(dir, 'timescope.db');
fs.copyFileSync(source, copy);
for (const suffix of ['-wal', '-shm', '-journal']) {
  if (fs.existsSync(source + suffix)) fs.copyFileSync(source + suffix, copy + suffix);
}
function fingerprint() {
  const db = new DatabaseSync(copy, { readOnly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    return tables.map(({ name }) => {
      const rows = db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}" ORDER BY rowid`).all();
      return { table: name, count: rows.length, hash: crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
    });
  } finally { db.close(); }
}
const before = fingerprint();
const bundle = path.join(dir, 'db.cjs');
await build({ entryPoints: ['src/main/db.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: bundle });
const { openDb } = createRequire(import.meta.url)(bundle);
const db = openDb(copy);
try {
  if (db.get('PRAGMA integrity_check').integrity_check !== 'ok') throw new Error('Integrity check failed');
} finally { db.close(); }
const after = fingerprint();
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('History changed during upgrade');
console.log(JSON.stringify({ passed: true, tables: after.map(({ table, count }) => ({ table, count })), originalUntouched: true }, null, 2));
