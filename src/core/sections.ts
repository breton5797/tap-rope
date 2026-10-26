/**
 * Section split (GDD v5 §6): cuts the planned hazard specs into `sections` near-even sections.
 * Cuts fall only between planned chunks (a chunk = a single, a pattern or a pulse run, starting at a
 * spec with `head`). When a chunk straddles the even split, later chunks that still fit are pulled in
 * front of it (it then opens the next section) — never letting two pulse runs touch. Deterministic.
 */
import type { Spec } from './specs';

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
