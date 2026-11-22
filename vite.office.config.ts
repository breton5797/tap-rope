// Office build (칼퇴근 대작전, office spec §10): the v8 app from office.html with the modules in
// build/office-swaps.ts swapped for src/office/, emitted to dist/office/ (served at ./office/ next to v8).
// Mode 'office' reads .env.office: the project URL and PUBLISHABLE key for the optional sign-in only (login
// spec §2). Game data stays on the device: FEATURES.online is false and src/platform/online.ts is swapped for
// an always-offline stub, so no leaderboard / register / submit-run call ships. Run: npm run build:office
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { APP_SWAPS } from './build/app-swaps.ts';
import { OFFICE_SWAPS } from './build/office-swaps.ts';
import { serviceWorker } from './build/service-worker.ts';
import { swapModules } from './build/swap-modules.ts';

export { OFFICE_SWAPS };

/** public-office files precached by the office worker (incl. the privacy policy and terms pages) */
const PUBLIC_FILES = ['./privacy.html', './terms.html', './manifest.webmanifest', './icon.svg', './icon-maskable.svg', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

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

/** Capacitor's webDir for the iPad app build (`--mode office-app`) */
export const APP_OUT_DIR = 'dist-ios';

/** the app build ships no sign-in: OAuth cannot return to capacitor://localhost */
export function appEnvCheck(env: Readonly<Record<string, string | undefined>>): void {
  if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('office app build: sign-in env must be empty (OAuth cannot return to the iPad app)');
  }
}

/** Google's public AdMob test publisher (the test-ads pages for iOS and Android) */
const ADMOB_TEST_PUB = 'ca-app-pub-3940256099942544';

/** a release app build (VITE_RELEASE=1) must carry production rewarded units for both stores (review M7) */
export function releaseAdCheck(env: Readonly<Record<string, string | undefined>>): void {
  if (env.VITE_RELEASE !== '1') return;
  if (env.VITE_REVIEW_DEMO === '1') throw new Error('office app release: VITE_REVIEW_DEMO is for App Review recording builds only');
  for (const key of ['VITE_ADMOB_REWARDED_IOS', 'VITE_ADMOB_REWARDED_ANDROID'] as const) {
    const v = env[key] ?? '';
    if (!v.startsWith('ca-app-pub-')) throw new Error(`office app release: set ${key} to the production AdMob rewarded unit`);
    if (v.startsWith(ADMOB_TEST_PUB)) throw new Error(`office app release: ${key} is a Google test unit`);
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const app = mode === 'office-app';
  if (app) {
    appEnvCheck(env);
    releaseAdCheck({ ...env, VITE_RELEASE: process.env.VITE_RELEASE ?? env.VITE_RELEASE });
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (key && !key.startsWith('sb_publishable_')) {
    throw new Error('office build: VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key (never a secret / service key)');
  }
  if (Boolean(env.VITE_SUPABASE_URL) !== Boolean(key)) {
    throw new Error('office build: set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for sign-in, or neither');
  }
  return {
    base: './',
    publicDir: 'public-office',
    // officeIndex (post) runs before the worker plugin (post, later in the list), so sw.js precaches index.html
    // the app build has no worker: WKWebView cannot register one, and app updates must never serve stale caches
    plugins: [
      swapModules(app ? { ...OFFICE_SWAPS, ...APP_SWAPS } : OFFICE_SWAPS),
      officeIndex(),
      ...(app ? [] : [serviceWorker({ publicDir: 'public-office', publicFiles: PUBLIC_FILES, cachePrefix: 'office-escape-', skip: [] })]),
    ],
    build: {
      target: 'es2022',
      outDir: app ? APP_OUT_DIR : 'dist/office',
      emptyOutDir: true, // only dist/office: the v8 build next to it is left alone
      rollupOptions: { input: 'office.html' },
    },
  };
});
