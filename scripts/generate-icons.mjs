/**
 * Generates tray/app PNG icons at build time (no binary assets in the repo).
 * Minimal PNG encoder using zlib — draws a rounded "hourglass dot" motif.
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets');
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draw a filled ring + center dot (clock-ish motif) into an RGBA buffer. */
function drawIcon(size, [r, g, b]) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const outer = size * 0.46;
  const ringWidth = size * 0.12;
  const dot = size * 0.14;
  const handLen = outer - ringWidth * 1.8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let a = 0;
      // ring
      const ringDist = Math.abs(d - (outer - ringWidth / 2));
      if (ringDist < ringWidth / 2 + 0.7) a = Math.max(a, smooth(ringWidth / 2 + 0.7 - ringDist));
      // center dot
      if (d < dot + 0.7) a = Math.max(a, smooth(dot + 0.7 - d));
      // clock hand pointing up-right
      const proj = dx * 0.5 + dy * -0.87; // direction ~ -60deg
      const perp = Math.abs(dx * 0.87 + dy * 0.5);
      if (proj > 0 && proj < handLen && perp < size * 0.055 + 0.7) {
        a = Math.max(a, smooth(size * 0.055 + 0.7 - perp));
      }
      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = Math.round(255 * Math.min(1, a));
    }
  }
  return buf;
}

function smooth(v) {
  return Math.max(0, Math.min(1, v));
}

const teal = [45, 212, 191]; // active
const gray = [148, 155, 164]; // paused

for (const [name, color, size] of [
  ['tray-active.png', teal, 32],
  ['tray-paused.png', gray, 32],
  ['icon.png', teal, 1024],
]) {
  fs.writeFileSync(path.join(outDir, name), encodePng(size, size, drawIcon(size, color)));
  console.log('wrote assets/' + name);
}

// electron-builder expects an ICNS file for a polished macOS app and DMG.
// An ICNS is a compact container of PNGs; assembling it directly avoids the
// platform-specific iconutil tool (which rejects valid iconsets on some Xcode
// beta releases).
if (process.platform === 'darwin') {
  fs.rmSync(path.join(outDir, 'TimeScope.iconset'), { recursive: true, force: true });
  const chunks = [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
  ].map(([type, size]) => {
    const png = encodePng(size, size, drawIcon(size, teal));
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([header, png]);
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(8 + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);
  fs.writeFileSync(path.join(outDir, 'icon.icns'), Buffer.concat([header, ...chunks]));
  console.log('wrote assets/icon.icns');
}
