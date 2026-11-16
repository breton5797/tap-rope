/** what the run hook needs from a finished run (a subset of RunSummary) */
import type { RunSummary } from '../../../types';

export type { DateKey, LiveRunCounts, LiveRunOutcome, LiveSave, ProgressTier } from './types';
export type RunSummaryLike = Pick<RunSummary, 'stageId' | 'cleared' | 'score'>;
