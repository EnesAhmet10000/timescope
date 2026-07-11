import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  external: ['electron', 'koffi', 'node-sqlite3-wasm'],
  logLevel: 'info',
};

const configs = [
  { ...common, entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.js' },
  { ...common, entryPoints: ['src/preload/index.ts'], outfile: 'dist/preload/index.js' },
];

if (watch) {
  for (const cfg of configs) {
    const ctx = await context(cfg);
    await ctx.watch();
  }
  console.log('[build-main] watching...');
} else {
  await Promise.all(configs.map((cfg) => build(cfg)));
}
