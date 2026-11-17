// App build (vite --mode office-app) replacement for src/platform/haptics.ts: WKWebView has no Vibration API,
// so the same calls drive Capacitor Haptics (Taptic Engine / Android vibrator). Same export surface.
import { Haptics as Native, ImpactStyle, NotificationType } from '@capacitor/haptics';

export interface Haptics {
  vibrate(p: number | number[]): void;
  setEnabled(on: boolean): void;
}

/** a web vibration pattern → the closest native feedback (a pattern = a success burst, short taps by length) */
export function nativeFeedback(p: number | number[]): { readonly kind: 'notify' } | { readonly kind: 'impact'; readonly style: ImpactStyle } {
  if (Array.isArray(p)) return { kind: 'notify' };
  return { kind: 'impact', style: p < 10 ? ImpactStyle.Light : p < 20 ? ImpactStyle.Medium : ImpactStyle.Heavy };
}

export function createHaptics(): Haptics {
  let enabled = true;
  return {
    vibrate(p) {
      if (!enabled || (typeof p === 'number' && p <= 0)) return;
      const f = nativeFeedback(p);
      const run = f.kind === 'notify' ? Native.notification({ type: NotificationType.Success }) : Native.impact({ style: f.style });
      run.catch(() => undefined);
    },
    setEnabled(on) {
      enabled = on;
    },
  };
}
