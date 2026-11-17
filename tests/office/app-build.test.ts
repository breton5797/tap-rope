// iPad app build (mode 'office-app'): the office game packaged by Capacitor. OAuth cannot return to
// capacitor://localhost and WKWebView has no service worker, so the app build ships neither.
import { readFileSync } from 'node:fs';
import type { PluginOption, UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import officeConfig, { APP_OUT_DIR, appEnvCheck, releaseAdCheck } from '../../vite.office.config';
import { APP_SWAPS } from '../../build/app-swaps';

type ConfigFn = (env: { mode: string; command: 'build' | 'serve' }) => UserConfig;

const resolve = (mode: string): UserConfig => (officeConfig as unknown as ConfigFn)({ mode, command: 'build' });

const pluginNames = (plugins: PluginOption[] | undefined): string[] =>
  (plugins ?? []).flat().flatMap((p) => (p && typeof p === 'object' && 'name' in p ? [p.name] : []));

describe('office app build (iPad)', () => {
  it('emits to dist-ios without the service worker', () => {
    const cfg = resolve('office-app');
    expect(APP_OUT_DIR).toBe('dist-ios');
    expect(cfg.build?.outDir).toBe('dist-ios');
    expect(pluginNames(cfg.plugins)).not.toContain('tap-rope-sw');
    expect(pluginNames(cfg.plugins)).toContain('office-index');
  });

  it('keeps the web build unchanged (dist/office with the worker)', () => {
    const cfg = resolve('office');
    expect(cfg.build?.outDir).toBe('dist/office');
    expect(pluginNames(cfg.plugins)).toContain('tap-rope-sw');
  });

  it('refuses sign-in env in the app build (OAuth cannot return to the app)', () => {
    expect(() => appEnvCheck({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toThrow(/app build/);
    expect(() => appEnvCheck({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toThrow(/app build/);
    expect(() => appEnvCheck({})).not.toThrow();
  });

  it('a release app build needs production rewarded units on both platforms (never Google test units)', () => {
    const prodIos = 'ca-app-pub-1111111111111111/2222222222';
    const prodAnd = 'ca-app-pub-1111111111111111/3333333333';
    expect(() => releaseAdCheck({})).not.toThrow(); // not a release: test units are fine
    expect(() => releaseAdCheck({ VITE_RELEASE: '1' })).toThrow(/VITE_ADMOB_REWARDED_IOS/);
    expect(() => releaseAdCheck({ VITE_RELEASE: '1', VITE_ADMOB_REWARDED_IOS: prodIos, VITE_ADMOB_REWARDED_ANDROID: 'ca-app-pub-3940256099942544/5224354917' })).toThrow(/test/);
    expect(() => releaseAdCheck({ VITE_RELEASE: '1', VITE_ADMOB_REWARDED_IOS: prodIos, VITE_ADMOB_REWARDED_ANDROID: prodAnd })).not.toThrow();
  });

  it('app swaps keep every export of the module they replace', () => {
    const names = (file: string): string[] =>
      [...readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').matchAll(/^export (?:async )?(?:function|const|interface|type|class) (\w+)/gm)].map((m) => m[1]!);
    for (const [from, to] of Object.entries(APP_SWAPS)) {
      const missing = names(from).filter((n) => !names(to).includes(n) && !readFileSync(new URL(`../../${to}`, import.meta.url), 'utf8').includes(`export type { ${n} }`));
      expect(missing, `${to} lacks exports of ${from}`).toEqual([]);
    }
  });

  it('points Capacitor at the app build with the office name', () => {
    const cap = JSON.parse(readFileSync(new URL('../../capacitor.config.json', import.meta.url), 'utf8')) as Record<string, unknown>;
    expect(cap.webDir).toBe('dist-ios');
    expect(cap.appName).toBe('칼퇴근 대작전');
    expect(cap.appId).toBe('com.heesookyang.taprope');
  });
});
