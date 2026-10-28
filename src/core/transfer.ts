/**
 * v8 device transfer code ("이전 코드", GDD-v8 A5): the whole save plus the leaderboard device identity
 * (secret, player id, call sign) as one copy-pasteable line `LE2.<base64url JSON>.<fnv-1a hex>`.
 * The checksum catches typos; the embedded save keeps its own version (a newer build's code is refused).
 * Importing writes the save and the identity, then the app reloads.
 */
import type { SaveData } from '../types';
import { SAVE_KEY, SAVE_VERSION, parseSave } from './storage';

const PREFIX = 'LE2';
const FORMAT = 1;
/** same key as platform/online (DEVICE_KEY); kept here so core never imports platform code */
const DEVICE_KEY = 'laserescape.device.v1';
/** the identity an import replaced (its call sign is otherwise orphaned on the server) */
export const DEVICE_BACKUP_KEY = 'laserescape.device.backup';

export interface TransferIdentity {
  readonly secret: string;
  readonly playerId: string | null;
  readonly nickname: string | null;
}

export type TransferResult =
  | { readonly ok: true; readonly save: SaveData; readonly identity: TransferIdentity | null }
  | { readonly ok: false; readonly error: string };

const ERR = {
  format: '이전 코드 형식이 아니에요. 전체를 복사했는지 확인해 주세요.',
  checksum: '코드 일부가 바뀌었어요. 다시 복사해 붙여 넣어 주세요.',
  newer: '새 버전에서 만든 코드예요. 앱을 업데이트한 뒤 가져와 주세요.',
} as const;

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseIdentity(raw: unknown): TransferIdentity | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.secret !== 'string' || !/^[0-9a-f]{64}$/.test(r.secret)) return null;
  return {
    secret: r.secret,
    playerId: typeof r.playerId === 'string' ? r.playerId : null,
    nickname: typeof r.nickname === 'string' ? r.nickname : null,
  };
}

export function encodeTransfer(save: SaveData, identity: TransferIdentity | null): string {
  const body = toBase64Url(JSON.stringify({ f: FORMAT, s: save, d: identity }));
  return `${PREFIX}.${body}.${fnv1a(body)}`;
}

export function decodeTransfer(code: string): TransferResult {
  const parts = code.replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return { ok: false, error: ERR.format };
  if (fnv1a(parts[1]) !== parts[2]) return { ok: false, error: ERR.checksum };
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(parts[1]));
  } catch {
    return { ok: false, error: ERR.format };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: ERR.format };
  const { f, s, d } = raw as Record<string, unknown>;
  if (f !== FORMAT || typeof s !== 'object' || s === null) return { ok: false, error: ERR.format };
  const v = (s as Record<string, unknown>).version;
  if (typeof v === 'number' && v > SAVE_VERSION) return { ok: false, error: ERR.newer };
  return { ok: true, save: parseSave(s), identity: parseIdentity(d) };
}

export function readIdentity(store: Pick<Storage, 'getItem'> | undefined): TransferIdentity | null {
  try {
    const text = store?.getItem(DEVICE_KEY);
    return text ? parseIdentity(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

/**
 * Writes an imported save (and identity, when the code carried one). A different identity already on this
 * device is backed up first (DEVICE_BACKUP_KEY). False when storage refused.
 */
export function applyTransfer(
  result: Extract<TransferResult, { ok: true }>, store: Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem'>> | undefined,
): boolean {
  if (!store) return false;
  try {
    if (result.identity) {
      const current = store.getItem?.(DEVICE_KEY) ?? null;
      const mine = current ? parseIdentity(safeJson(current)) : null;
      if (current && mine?.secret !== result.identity.secret) store.setItem(DEVICE_BACKUP_KEY, current);
    }
    store.setItem(SAVE_KEY, JSON.stringify(result.save));
    if (result.identity) store.setItem(DEVICE_KEY, JSON.stringify(result.identity));
    return true;
  } catch {
    return false;
  }
}
