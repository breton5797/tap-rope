// Registers the offline service worker in production web builds only.

/** the iPad app build (vite --mode office-app) ships no sw.js: WKWebView has no service worker */
export function shouldRegister(env: { readonly PROD: boolean; readonly MODE: string }): boolean {
  return env.PROD && env.MODE !== 'office-app';
}

export function registerServiceWorker(): void {
  if (!shouldRegister(import.meta.env)) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const register = (): void => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
