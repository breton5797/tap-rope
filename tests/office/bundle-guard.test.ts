// Office login build guard (login spec §2): the office bundle may carry the project URL and the publishable
// key for Supabase Auth, but never a game-data endpoint (register, submit-run, leaderboard, nickname,
// achievements) and never a secret key; the auth client is a lazy chunk guests don't load.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';

const out = mkdtempSync(join(tmpdir(), 'office-guard-'));
let entry = '';
let all = '';
let files: string[] = [];

beforeAll(async () => {
  await build({ configFile: 'vite.office.config.ts', mode: 'office', logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
  files = readdirSync(join(out, 'assets')).filter((f) => f.endsWith('.js'));
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const main = files.find((f) => html.includes(f)) ?? '';
  entry = readFileSync(join(out, 'assets', main), 'utf8');
  all = files.map((f) => readFileSync(join(out, 'assets', f), 'utf8')).join('\n');
}, 120_000);

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('office bundle guard', () => {
  it('ships no game-data endpoint', () => {
    for (const path of ['functions/v1', 'submit-run', 'leaderboard?board', "'register'", '"register"', "'nickname'", '"nickname"']) {
      expect(all.includes(path), path).toBe(false);
    }
  });

  it('carries the public URL and a publishable key only', () => {
    expect(all).toContain('bmstuotifpmaspszrgyi.supabase.co');
    expect(all).toMatch(/sb_publishable_/);
    expect(all).not.toMatch(/sb_secret_[\w-]{8,}/);
  });

  it('loads the auth client lazily (not in the entry chunk)', () => {
    expect(files.length).toBeGreaterThan(1);
    expect(entry.includes('signInWithOAuth')).toBe(false);
    expect(all.includes('signInWithOAuth')).toBe(true);
  });
});
