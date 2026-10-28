import { describe, expect, it } from 'vitest';
import { COPY, FEATURES, SAVE_PREFIX, V8_COPY, runSeedFor } from '../../src/flavor';
import * as office from '../../src/office/flavor';
import { LEGACY_SAVE_KEY, SAVE_KEY } from '../../src/core/storage';
import { DEVICE_KEY, QUEUE_KEY } from '../../src/platform/online';
import { DEVICE_BACKUP_KEY } from '../../src/core/transfer';
import { STAGES } from '../../src/core/content';

describe('v8 flavor (defaults)', () => {
  it('keeps the v8 save keys', () => {
    expect(SAVE_PREFIX).toBe('laserescape');
    expect(SAVE_KEY).toBe('laserescape.save.v2');
    expect(LEGACY_SAVE_KEY).toBe('laserescape.save.v1');
    expect(DEVICE_KEY).toBe('laserescape.device.v1');
    expect(QUEUE_KEY).toBe('laserescape.queue.v1');
    expect(DEVICE_BACKUP_KEY).toBe('laserescape.device.backup');
  });

  it('uses the stage seed for every run', () => {
    for (const stage of STAGES) expect(runSeedFor(stage)).toBe(stage.seed);
  });

  it('enables every v8 feature and no first-run picker', () => {
    expect(FEATURES).toEqual({ online: true, endless: true, daily: true, shop: true, leaderboard: true, transfer: true, firstRunPick: false });
  });

  it('serves the v8 copy', () => {
    expect(COPY).toBe(V8_COPY);
    expect(COPY.titleStart).toBe('작전 개시');
    expect(COPY.resultWinTitle).toBe('임무 완료');
  });
});

describe('office flavor', () => {
  it('uses its own save prefix and the offline feature set', () => {
    expect(office.SAVE_PREFIX).toBe('officeescape');
    expect(office.FEATURES).toEqual({ online: false, endless: false, daily: false, shop: false, leaderboard: false, transfer: false, firstRunPick: true });
  });

  it('draws a fresh uint32 seed per call', () => {
    const seeds = Array.from({ length: 20 }, () => office.runSeedFor(STAGES[0]));
    for (const s of seeds) expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('has a value for every copy key', () => {
    expect(Object.keys(office.COPY).sort()).toEqual(Object.keys(V8_COPY).sort());
  });
});
