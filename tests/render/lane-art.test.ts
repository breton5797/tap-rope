// The rhythm lane's pickup art hook (office seam, polish P1a): v8 never sets it, so v8 pickups keep their icons.
import { describe, expect, it } from 'vitest';
import { laneArt } from '../../src/render/lane';

describe('laneArt', () => {
  it('is unset in v8', () => {
    expect(laneArt.pickup).toBeNull();
  });
});
