// Office music (칼퇴근 대작전, spec §9), swapped in for src/audio/music.ts: the same look-ahead loop engine on
// the same beat grid (hazards land on the stage tempo, so the tempo is never scaled), re-voiced as a bright
// major-key office comedy — short bouncy octave bass, open 8th hats and a cheeky bell / whistle motif.
import type { WorldId } from '../../types';
import { createStyledMusic, type Music, type Style } from '../../audio/music';

export * from '../../audio/music';

/** 0 office, 1 pantry corridor, 2 meeting rooms, 3 elevator hall / lobby — all major (I–IV–V–IV style) */
const PART1_STYLES = {
  0: {
    root: 41, prog: [0, 5, 7, 5], pad: [0, 4, 7, 11], bassType: 'square', bassCut: 900, bassLine: [0, 12, 0, 12, 7, 12, 0, 12], bassLen: 0.9,
    hits: [0, 8], hatEvery: 2, hatFreq: 9000, padType: 'triangle', padCut: 2400,
    motif: [[2, 77], [6, 81], [10, 84], [34, 79], [38, 77], [42, 76]], motifType: 'square',
  },
  1: {
    root: 43, prog: [0, 5, 2, 7], pad: [0, 4, 7, 9], bassType: 'triangle', bassCut: 1200, bassLine: [0, 12, 7, 12, 0, 12, 4, 7], bassLen: 0.8,
    hits: [0, 6, 8], hatEvery: 2, hatFreq: 10000, padType: 'triangle', padCut: 2600,
    motif: [[4, 79], [12, 83], [20, 86], [36, 84], [44, 79], [52, 81]], motifType: 'sine',
  },
  2: {
    root: 38, prog: [0, 7, 5, 7], pad: [0, 4, 7], bassType: 'square', bassCut: 800, bassLine: [0, 0, 12, 0, 7, 0, 12, 7], bassLen: 1,
    hits: [0, 8, 11], hatEvery: 2, hatFreq: 8000, padType: 'sawtooth', padCut: 1500,
    motif: [[0, 74], [8, 78], [16, 81], [40, 79], [48, 78]], motifType: 'triangle', clank: [14],
  },
  3: {
    root: 40, prog: [0, 5, 7, 0], pad: [0, 4, 7, 12], bassType: 'square', bassCut: 1000, bassLine: [0, 12, 0, 12, 0, 12, 7, 12], bassLen: 0.85,
    hits: [0, 4, 8, 12], hatEvery: 1, hatFreq: 9500, padType: 'triangle', padCut: 2800,
    motif: [[0, 88], [3, 84], [32, 88], [35, 84], [48, 91]], motifType: 'sine',
  },
} satisfies Readonly<Record<0 | 1 | 2 | 3, Style>>;
/**
 * part 2 (the way home), still major and on the shared engine: 4 퇴근길 거리 = upbeat (I–V–vi–IV, 16th hats),
 * 5 지하철역 = driving (steady octave 8ths, four-on-the-floor hits, a turnstile clank), 6 먹자골목 = festive
 * (bouncy trot-style bass and a bell motif). Stage 10 (theme 4 at night) shares the street loop.
 */
const PART2_STYLES = {
  4: {
    root: 41, prog: [0, 7, 9, 5], pad: [0, 4, 7, 12], bassType: 'square', bassCut: 1100, bassLine: [0, 12, 7, 12, 0, 12, 9, 12], bassLen: 0.8,
    hits: [0, 6, 8], hatEvery: 1, hatFreq: 9800, padType: 'triangle', padCut: 2600,
    motif: [[2, 81], [6, 84], [10, 88], [18, 86], [34, 84], [38, 81], [42, 79], [50, 81]], motifType: 'square',
  },
  5: {
    root: 40, prog: [0, 0, 5, 7], pad: [0, 4, 7], bassType: 'sawtooth', bassCut: 950, bassLine: [0, 12, 0, 12, 0, 12, 0, 12], bassLen: 0.75,
    hits: [0, 4, 8, 12], hatEvery: 1, hatFreq: 10500, padType: 'sawtooth', padCut: 1700,
    motif: [[0, 76], [4, 79], [8, 83], [32, 76], [36, 79], [40, 84]], motifType: 'triangle', clank: [6, 14],
  },
  6: {
    root: 43, prog: [0, 5, 7, 5], pad: [0, 4, 7, 9], bassType: 'triangle', bassCut: 1300, bassLine: [0, 7, 12, 7, 0, 7, 12, 7], bassLen: 0.7,
    hits: [0, 8, 10], hatEvery: 2, hatFreq: 9000, padType: 'triangle', padCut: 2800,
    motif: [[0, 86], [2, 88], [4, 91], [8, 88], [16, 86], [32, 83], [34, 86], [36, 88], [40, 91]], motifType: 'sine',
  },
} satisfies Readonly<Record<4 | 5 | 6, Style>>;
export const OFFICE_STYLES: Readonly<Record<WorldId, Style>> = { ...PART1_STYLES, ...PART2_STYLES };

export function createMusic(ctx: BaseAudioContext, out: AudioNode): Music {
  return createStyledMusic(ctx, out, OFFICE_STYLES);
}
