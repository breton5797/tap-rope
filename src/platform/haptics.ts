// Vibration wrapper; silently no-ops where the Vibration API is unavailable.

export interface Haptics {
  vibrate(p: number | number[]): void;
  setEnabled(on: boolean): void;
}

export function createHaptics(): Haptics {
  let enabled = true;
  const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  return {
    vibrate(p) {
      if (!enabled || !supported) return;
      try {
        navigator.vibrate(p);
      } catch {
        // Some browsers throw when called without user activation.
      }
    },
    setEnabled(on) {
      enabled = on;
      if (!on && supported) {
        try {
          navigator.vibrate(0);
        } catch {
          // ignore
        }
      }
    },
  };
}
