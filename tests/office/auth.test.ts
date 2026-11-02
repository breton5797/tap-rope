// Office login (login spec §2–3): the bare Supabase Auth client (auth-js) with PKCE, OAuth back to the office root, the
// tester flag only from app_metadata; the account store loads the client lazily (guests never do).
import { describe, expect, it, vi } from 'vitest';
import { authEnv, redirectTo, sessionKey } from '../../src/office/platform/auth-env';
import { createAuth, isTester, type Auth } from '../../src/office/platform/auth';
import { createAccount, GUEST } from '../../src/office/platform/account';

const BASE_URL = 'https://breton5797.github.io/tap-rope/office/';
const ENV = { url: 'https://bmstuotifpmaspszrgyi.supabase.co', key: 'sb_publishable_x' };

describe('auth config', () => {
  it('needs the URL and a publishable key (never a secret key)', () => {
    const get = (m: Record<string, string>) => (k: string) => m[k] ?? '';
    expect(authEnv(get({}))).toBeNull();
    expect(authEnv(get({ VITE_SUPABASE_URL: ENV.url, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' }))).toBeNull();
    expect(authEnv(get({ VITE_SUPABASE_URL: ENV.url, VITE_SUPABASE_PUBLISHABLE_KEY: ENV.key }))).toEqual(ENV);
  });

  it('knows the session key and the office redirect', () => {
    expect(sessionKey(ENV.url)).toBe('sb-bmstuotifpmaspszrgyi-auth-token');
    expect(redirectTo({ origin: 'https://breton5797.github.io', pathname: '/tap-rope/office/index.html' })).toBe('https://breton5797.github.io/tap-rope/office/');
    expect(redirectTo({ origin: 'http://localhost:5173', pathname: '/office/' })).toBe('http://localhost:5173/office/');
  });
});

describe('auth client', () => {
  function fake() {
    const client = {
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(async () => ({ data: { session: { user: { email: 'a@b.c', app_metadata: { office_tester: true } } } } })),
    };
    const make = vi.fn(() => client as never);
    return { auth: client, make };
  }

  it('is auth only, PKCE, session in storage, OAuth back to the office root', async () => {
    const { auth, make } = fake();
    const a = createAuth(ENV, make, { origin: 'https://breton5797.github.io', pathname: '/tap-rope/office/' });
    expect(make).toHaveBeenCalledWith({
      url: `${ENV.url}/auth/v1`, headers: { apikey: ENV.key }, storageKey: 'sb-bmstuotifpmaspszrgyi-auth-token',
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce',
    });
    await a.signIn('apple');
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'apple', options: { redirectTo: 'https://breton5797.github.io/tap-rope/office/' } });
    expect((await a.currentUser())?.email).toBe('a@b.c');
    await a.signOut();
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('a tester is only the server-set app_metadata flag', () => {
    expect(isTester({ app_metadata: { office_tester: true } } as never)).toBe(true);
    expect(isTester({ app_metadata: { office_tester: 'true' } } as never)).toBe(false);
    expect(isTester({ app_metadata: {} } as never)).toBe(false);
    expect(isTester(null)).toBe(false);
  });
});

describe('account store', () => {
  function fakeAuth(user: { email: string; app_metadata: Record<string, unknown> } | null) {
    let cb: ((u: unknown) => void) | null = null;
    const auth: Auth = {
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
      onAuthChange: (f) => {
        cb = f as never;
        return () => undefined;
      },
      currentUser: async () => user as never,
    };
    return { auth, emit: (u: unknown) => cb?.(u) };
  }
  const tester = (u: { app_metadata?: Record<string, unknown> } | null): boolean => u?.app_metadata?.office_tester === true;

  it('guests never load the auth client', () => {
    const loadAuth = vi.fn();
    const acc = createAccount({ configured: true, loadAuth, stored: () => false, href: () => BASE_URL, replaceUrl: () => undefined });
    acc.init();
    expect(loadAuth).not.toHaveBeenCalled();
    expect(acc.state()).toEqual(GUEST);
  });

  it('restores a stored session at boot and reports the tester flag', async () => {
    const { auth } = fakeAuth({ email: 'boss@example.com', app_metadata: { office_tester: true } });
    const acc = createAccount({ configured: true, loadAuth: async () => ({ auth, isTester: tester as never }), stored: () => true, href: () => BASE_URL, replaceUrl: () => undefined });
    const seen: unknown[] = [];
    acc.onChange((s) => seen.push(s));
    acc.init();
    await vi.waitFor(() => expect(acc.state().signedIn).toBe(true));
    expect(acc.state()).toEqual({ signedIn: true, email: 'boss@example.com', tester: true });
    expect(seen).toHaveLength(1);
  });

  it('a normal member is signed in but not a tester; sign-out returns to guest', async () => {
    const { auth, emit } = fakeAuth(null);
    const acc = createAccount({ configured: true, loadAuth: async () => ({ auth, isTester: tester as never }), stored: () => false, href: () => BASE_URL, replaceUrl: () => undefined });
    await acc.signIn('google');
    expect(auth.signIn).toHaveBeenCalledWith('google');
    emit({ email: 'member@example.com', app_metadata: {} });
    expect(acc.state()).toEqual({ signedIn: true, email: 'member@example.com', tester: false });
    await acc.signOut();
    expect(acc.state()).toEqual(GUEST);
  });

  it('without login config it is unavailable and stays a guest', () => {
    const loadAuth = vi.fn();
    const acc = createAccount({ configured: false, loadAuth, stored: () => true, href: () => BASE_URL, replaceUrl: () => undefined });
    acc.init();
    expect(acc.available).toBe(false);
    expect(loadAuth).not.toHaveBeenCalled();
  });
});
