/**
 * Where the privacy policy / terms links point. Web: the pages next to the game. App build (office-app): the
 * published pages — Capacitor hands an outside https link to the system browser, so the game is not replaced
 * by the page (a relative link navigated the game WebView itself on Android, verified 2026-11-18).
 */
export const PUBLISHED_OFFICE = 'https://breton5797.github.io/tap-rope/office/';

export function legalHref(page: 'privacy.html' | 'terms.html', mode: string = import.meta.env.MODE): string {
  return mode === 'office-app' ? `${PUBLISHED_OFFICE}${page}` : `./${page}`;
}
