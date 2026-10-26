// Types for the generated sim.js bundle (see vite.sim.config.ts).
import type { RunRecord } from '../../../src/types';

export declare const SIM_VERSION: string;
export declare function simulateRun(record: RunRecord): {
  readonly score: number;
  readonly endTime: number;
  readonly status: 'playing' | 'cleared' | 'failed';
};
