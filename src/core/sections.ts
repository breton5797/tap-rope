/**
 * Section split (GDD v5 §6): cuts the planned hazard specs into `sections` near-even sections.
 * Cuts fall only between planned chunks (a chunk = a single, a pattern or a pulse run, starting at a
 * spec with `head`). When a chunk straddles the even split, later chunks that still fit are pulled in
 * front of it (it then opens the next section) — never letting two pulse runs touch. Deterministic.
 * v8 (campaign only): warmUp moves a gentle single (1단 floor laser, one-lane guard or ceiling slide)
 * to the front of each section so no section opens on a hard hazard.
 */
import { specMove, type Spec } from './specs';

type Chunk = readonly Spec[];

function chunksOf(specs: readonly Spec[]): Chunk[] {
  return specs.reduce<Spec[][]>((acc, s) => {
    if (s.head || acc.length === 0) return [...acc, [s]];
    return [...acc.slice(0, -1), [...acc[acc.length - 1], s]];
  }, []);
}

const size = (cs: readonly Chunk[]) => cs.reduce((n, c) => n + c.length, 0);
const pulseTouch = (cs: readonly Chunk[]) => cs.some((c, i) => i > 0 && c[0].pulse && cs[i - 1][0].pulse);

/** chunks for one section of `target` hazards; keeps `keep` chunks for the sections after it */
function fillSection(done: readonly Chunk[], rest: readonly Chunk[], target: number, keep: number) {
  let taken: Chunk[] = [];
  let left = [...rest];
  while (left.length > keep) {
    const acc = size(taken);
    if (acc + left[0].length <= target) {
      taken = [...taken, left[0]];
      left = left.slice(1);
      continue;
    }
    const without = (i: number) => [...left.slice(0, i), ...left.slice(i + 1)];
    const pull = left.findIndex((c, i) => i > 0 && acc + c.length <= target
      && !pulseTouch([...done, ...taken, c, ...without(i)]));
    if (pull > 0 && left.length - 1 > keep - 1) {
      taken = [...taken, left[pull]];
      left = without(pull);
      continue;
    }
    // the next chunk overflows: take it only if that lands closer to the target than stopping here
    if (taken.length === 0 || acc + left[0].length - target < target - acc) {
      taken = [...taken, left[0]];
      left = left.slice(1);
    }
    break;
  }
  return { taken, left };
}

/** reordered specs and the indices that open sections 1..sections−1 */
export function splitSections(specs: readonly Spec[], sections: number): { specs: Spec[]; starts: number[] } {
  const n = specs.length;
  let done: Chunk[] = [];
  let rest = chunksOf(specs);
  let starts: number[] = [];
  for (let j = 1; j < sections && rest.length > 1; j++) {
    const target = Math.round((j * n) / sections) - size(done);
    const { taken, left } = fillSection(done, rest, target, Math.min(rest.length - 1, sections - j));
    done = [...done, ...taken];
    rest = left;
    starts = [...starts, size(done)];
  }
  return { specs: [...done, ...rest].flat(), starts };
}

/** a gentle opener: a 1단 floor laser, a one-lane guard or a ceiling slide laser, alone */
function isWarmUp(c: Chunk): boolean {
  if (c.length !== 1 || c[0].pulse) return false;
  const [o, extra] = c[0].obstacles;
  if (!o || extra) return false;
  if (o.kind === 'floor') return c[0].required === 1;
  if (o.kind === 'guard') return (o.lanes ?? []).length === 1;
  return o.kind === 'ceiling';
}

const WARM_FLOOR: Spec = {
  obstacles: [{ kind: 'floor', level: 1 }], required: 1, needsSlide: false, pulse: false, tight: false, head: true,
};

/** a single whose move also appears elsewhere in the section (swapping it out keeps the move quota);
 * a jump-type one first so the stage keeps its slide share */
function spareSingle(cs: readonly Chunk[]): number {
  const moves = cs.flat().map(specMove);
  const spare = (c: Chunk) => c.length === 1 && !c[0].pulse && moves.filter((m) => m === specMove(c[0])).length > 1;
  const jumpType = cs.findIndex((c) => spare(c) && !c[0].needsSlide);
  return jumpType >= 0 ? jumpType : cs.findIndex(spare);
}

/** the section's chunks with its first warm-up chunk moved to the front; with none, a spare single
 * becomes a 1단 floor laser at the front (unchanged if neither exists) */
function warmSection(cs: readonly Chunk[]): Chunk[] {
  if (cs.length === 0 || isWarmUp(cs[0])) return [...cs];
  const without = (i: number) => [...cs.slice(0, i), ...cs.slice(i + 1)];
  const k = cs.findIndex((c, i) => isWarmUp(c) && !pulseTouch([c, ...without(i)]));
  if (k >= 0) return [cs[k], ...without(k)];
  const r = spareSingle(cs);
  return r >= 0 && !pulseTouch([[WARM_FLOOR], ...without(r)]) ? [[WARM_FLOOR], ...without(r)] : [...cs];
}

/** v8 campaign: every section opens on a warm-up hazard; section sizes and starts are unchanged */
export function warmUp(specs: readonly Spec[], starts: readonly number[]): Spec[] {
  const bounds = [0, ...starts, specs.length];
  return bounds.slice(0, -1).flatMap((from, j) => warmSection(chunksOf(specs.slice(from, bounds[j + 1]))).flat());
}
