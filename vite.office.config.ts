// Office build (칼퇴근 대작전, office spec §10): the v8 app from office.html with the modules in
// build/office-swaps.ts swapped for src/office/, emitted to dist/office/ (served at ./office/ next to v8).
// Mode 'office' reads .env.office, which blanks the server URL: the build is offline. Run: npm run build:office
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { OFFICE_SWAPS } from './build/office-swaps.ts';
import { serviceWorker } from './build/service-worker.ts';
import { swapModules } from './build/swap-modules.ts';

export { OFFICE_SWAPS };

const PUBLIC_FILES = ['./manifest.webmanifest', './icon.svg', './icon-maskable.svg', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

/** the entry is office.html in the repo root; the deployed folder serves it as index.html */
function officeIndex(): Plugin {
  return {
    name: 'office-index',
    apply: 'build',
    enforce: 'post', // after Vite has emitted the page
    generateBundle(_options, bundle) {
      const page = bundle['office.html'];
      if (!page || page.type !== 'asset') return;
      delete bundle['office.html'];
      this.emitFile({ type: 'asset', fileName: 'index.html', source: page.source });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('office build must be offline: VITE_SUPABASE_URL / _PUBLISHABLE_KEY must be empty (run with --mode office)');
  }
  return {
    base: './',
    publicDir: 'public-office',
    // officeIndex (post) runs before the worker plugin (post, later in the list), so sw.js precaches index.html
    plugins: [swapModules(OFFICE_SWAPS), officeIndex(), serviceWorker({ publicDir: 'public-office', publicFiles: PUBLIC_FILES, cachePrefix: 'office-escape-', skip: [] })],
    build: {
      target: 'es2022',
      outDir: 'dist/office',
      emptyOutDir: true, // only dist/office: the v8 build next to it is left alone
      rollupOptions: { input: 'office.html' },
    },
  };
});
