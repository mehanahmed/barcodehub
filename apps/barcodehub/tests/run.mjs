// Runs node:test files through Vite so `zitejs/*` aliases and TypeScript resolve the same way as in the app.
// Tests always use a throwaway in-memory database, never database/data.
import { after } from 'node:test';
import { createServer } from 'vite';

process.env.PGLITE_DATA_DIR = 'memory://';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node tests/run.mjs <test files...>');
  process.exit(1);
}

const server = await createServer({
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => server.close());

for (const file of files) await server.ssrLoadModule(file);
