import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../src/core/storage';
import { applyTransfer, decodeTransfer, encodeTransfer, readIdentity } from '../../src/core/transfer';
import type { SaveData } from '../../src/types';

const SECRET = 'ab'.repeat(32);
const id = { secret: SECRET, playerId: 'p-1', nickname: '요원K' };
const save: SaveData = {
  ...defaultSave(), coins: 321, stars: { 'w1-s1': 3, 'w1-s2': 2 }, ownedSkins: ['kid', 'cat'], skin: 'cat',
  achievements: { 'first-clear': 1761500000000 }, dailyStreak: { last: '2026-10-27', count: 4 },
};

function memStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => (k in data ? data[k] : null), setItem: (k: string, v: string) => { data[k] = v; } };
}

describe('transfer code', () => {
  it('round-trips the save and the device identity (Korean nickname included)', () => {
    const code = encodeTransfer(save, id);
    expect(code).toMatch(/^LE2\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    expect(decodeTransfer(code)).toEqual({ ok: true, save, identity: id });
    expect(decodeTransfer(encodeTransfer(save, null))).toEqual({ ok: true, save, identity: null });
  });

  it('tolerates whitespace / line breaks from copy-paste', () => {
    const code = encodeTransfer(save, id);
    const messy = `  ${code.slice(0, 20)}\n${code.slice(20, 40)} ${code.slice(40)}\n`;
    expect(decodeTransfer(messy).ok).toBe(true);
  });

  it('rejects typos (checksum), other formats and garbage with a Korean message', () => {
    const code = encodeTransfer(save, id);
    const i = 10;
    const typo = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    for (const bad of [typo, '', 'hello', 'LE1.abc.00000000', `${code}x`]) {
      const r = decodeTransfer(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/[가-힣]/);
    }
  });

  it('refuses a code from a newer build and drops an invalid identity', () => {
    const newer = encodeTransfer({ ...save, version: 9 } as unknown as SaveData, id);
    const r = decodeTransfer(newer);
    expect(r.ok).toBe(false);
    const badId = decodeTransfer(encodeTransfer(save, { ...id, secret: 'short' }));
    expect(badId).toEqual({ ok: true, save, identity: null });
  });

  it('readIdentity / applyTransfer use the online device key and the save key', () => {
    const st = memStore({ 'laserescape.device.v1': JSON.stringify(id) });
    expect(readIdentity(st)).toEqual(id);
    expect(readIdentity(memStore())).toBeNull();
    const target = memStore({ 'laserescape.save.v2': '{"version":2}', 'laserescape.device.v1': 'x' });
    const r = decodeTransfer(encodeTransfer(save, id));
    if (!r.ok) throw new Error('decode');
    expect(applyTransfer(r, target)).toBe(true);
    expect(JSON.parse(target.data['laserescape.save.v2'])).toEqual(save);
    expect(JSON.parse(target.data['laserescape.device.v1'])).toEqual(id);
    expect(applyTransfer(r, { setItem: () => { throw new Error('quota'); } })).toBe(false);
  });
});
