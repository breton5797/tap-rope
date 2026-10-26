/** Boss sound cues from frame-to-frame BossView changes (GDD-v7 §1). Pure. */
import type { BossView, SfxName } from '../types';

export function bossCues(prev: BossView | null, cur: BossView | null): SfxName[] {
  if (!cur) return [];
  const cues: SfxName[] = [];
  const changed = prev?.state !== cur.state;
  if (changed && cur.state === 'intro') cues.push('boss-intro');
  if (changed && cur.state === 'stagger') cues.push('boss-stagger');
  if (changed && cur.state === 'defeated') cues.push('boss-down');
  // a new telegraph: none before, or the previous one passed and the next is further away
  const a = cur.attack;
  const p = prev?.attack ?? null;
  if (a && (!p || a.timeUntil > p.timeUntil + 1e-6)) cues.push('boss-charge');
  return cues;
}
