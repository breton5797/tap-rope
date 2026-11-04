// v8 fail tip text is unchanged by the office stage-aware seam (failTipText)
import { describe, expect, it } from 'vitest';
import { FAIL_TIPS, failTipText } from '../../src/ui/moves';

describe('failTipText (v8)', () => {
  it('is the v8 FAIL_TIPS line whatever the stage', () => {
    expect(failTipText('lane', 'w3-s7')).toBe(FAIL_TIPS.lane);
    expect(failTipText('jump', null)).toBe(FAIL_TIPS.jump);
  });
});
