// Office login config (login spec §2) without loading the auth client: the public project URL and
// publishable key from the build env, where supabase-js keeps the session, and where OAuth returns to.
export interface AuthEnv {
  readonly url: string;
  readonly key: string;
}

const read = (key: string): string => {
  const v: unknown = (import.meta.env as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'string' ? v : '';
};

/** null = no login in this build (no URL or no publishable key; a secret key is never accepted) */
export function authEnv(get: (key: string) => string = read): AuthEnv | null {
  const url = get('VITE_SUPABASE_URL');
  const key = get('VITE_SUPABASE_PUBLISHABLE_KEY');
  return url && key.startsWith('sb_publishable_') ? { url, key } : null;
}

/** supabase-js's default session key: sb-<project ref>-auth-token */
export function sessionKey(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}

/** the office root the OAuth provider sends the player back to (…/office/, never …/index.html) */
export function redirectTo(loc: Pick<Location, 'origin' | 'pathname'>): string {
  return `${loc.origin}${loc.pathname.replace(/index\.html$/, '')}`;
}
