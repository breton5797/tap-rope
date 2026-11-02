// Office online layer, swapped in for src/platform/online.ts: the office has no leaderboard, nicknames or
// server runs (login spec §2: only Supabase Auth may be called), so this keeps the export surface with an
// always-offline client and ships none of the game-data endpoints.
import type { OnlineApi } from '../../types';
import { SAVE_PREFIX } from '../../flavor';

export const DEVICE_KEY = `${SAVE_PREFIX}.device.v1`;
export const QUEUE_KEY = `${SAVE_PREFIX}.queue.v1`;
export const QUEUE_MAX = 20;
export const TIMEOUT_MS = 8000;

export class RunRejectedError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(`run rejected: ${code}`);
    this.name = 'RunRejectedError';
  }
}

export class LeaderboardUnavailableError extends Error {
  constructor(readonly status: number | null) {
    super('leaderboard unavailable: offline');
    this.name = 'LeaderboardUnavailableError';
  }
}

export interface OnlineDeps {
  readonly baseUrl?: string;
  readonly apiKey?: string;
}

export const backoffMs = (attempts: number): number => Math.min(10 * 60 * 1000, 5000 * 2 ** attempts);

export function createOnline(_deps: OnlineDeps = {}): OnlineApi {
  return {
    ready: false,
    init: async () => undefined,
    nickname: () => null,
    setNickname: async () => '이 버전에서는 이름을 쓸 수 없어요',
    submitRun: async () => null,
    leaderboard: async () => {
      throw new LeaderboardUnavailableError(null);
    },
    syncAchievements: async () => undefined,
  };
}
