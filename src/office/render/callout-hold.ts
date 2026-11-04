// Attack callout timing (polish round P1b). A callout starts only while its beat is at least CALLOUT_END away
// (closer, the "!" and the prop take over), and once on screen it holds for at least CALLOUT_MIN — on dense
// stages it used to flash for ~0.28 s because the next beat's callout only began when the previous beat passed.
// A beat that arrives before it could start is skipped (merged into the callout already shown), never flashed.

/** a callout starts no later than this before its beat (s) */
export const CALLOUT_END = 0.35;
/** a started callout stays up at least this long (s), unless its beat arrives first */
export const CALLOUT_MIN = 0.5;

export class CalloutHold {
  private beat = -1;
  private since = 0;

  /** whether the callout for `beat` (arriving in `timeUntil` s) shows at `now` (s, monotonic) */
  show(beat: number, timeUntil: number, now: number): boolean {
    if (timeUntil < 0) return false;
    if (beat !== this.beat) {
      if (timeUntil < CALLOUT_END) return false;
      this.beat = beat;
      this.since = now;
      return true;
    }
    return timeUntil >= CALLOUT_END || now - this.since < CALLOUT_MIN;
  }
}
