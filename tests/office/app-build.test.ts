// iPad app build (mode 'office-app'): the office game packaged by Capacitor. OAuth cannot return to
// capacitor://localhost and WKWebView has no service worker, so the app build ships neither.
import { readFileSync } from 'node:fs';
import type { PluginOption, UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import officeConfig, { APP_OUT_DIR, appEnvCheck } from '../../vite.office.config';

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

  it('points Capacitor at the app build with the office name', () => {
    const cap = JSON.parse(readFileSync(new URL('../../capacitor.config.json', import.meta.url), 'utf8')) as Record<string, unknown>;
    expect(cap.webDir).toBe('dist-ios');
    expect(cap.appName).toBe('칼퇴근 대작전');
    expect(cap.appId).toBe('com.heesookyang.taprope');
  });
});
