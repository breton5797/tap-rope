/**
 * The one Monetization of the running game: created on first use (the app calls it at launch so the consent
 * flow and the pass check start early), with the platform's adapters, localStorage and the remote config.
 */
import { DEFAULT_CONFIG, loadConfig } from './config';
import { createMonetization, type Monetization } from './index';
import { monetizationPlatform } from './platform';

let current: Monetization | null = null;

const storage = (): Pick<Storage, 'getItem' | 'setItem'> | undefined => {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

export function monetization(): Monetization {
  if (current) return current;
  const p = monetizationPlatform();
  const m = createMonetization({ ads: p.ads, pass: p.pass, store: storage(), now: () => Date.now(), config: DEFAULT_CONFIG });
  if (p.configUrl) void loadConfig(p.configUrl).then((c) => m.setConfig(c));
  current = m;
  return m;
}
