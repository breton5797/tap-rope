// Office account (login spec §1–3), swapped in for src/platform/account.ts: optional Google / Apple sign-in.
// Guests never load the auth client: it is imported only when a stored session or an OAuth return (?code=)
// is found at boot, or when the player taps a sign-in button. Tester = the server-set app_metadata flag.
import { GUEST, type AccountState, type Provider } from '../../platform/account';
import type { Auth } from './auth';
import { authEnv, sessionKey } from './auth-env';

export { GUEST, type AccountState, type Provider };

type AuthUser = Parameters<Parameters<Auth['onAuthChange']>[0]>[0];

export interface AccountDeps {
  readonly configured: boolean;
  readonly loadAuth: () => Promise<{ readonly auth: Auth | null; readonly isTester: (u: AuthUser) => boolean }>;
  /** a stored session or an OAuth return is waiting (boot restores it) */
  readonly pending: () => boolean;
}

export interface Account {
  readonly available: boolean;
  state(): AccountState;
  onChange(cb: (s: AccountState) => void): () => void;
  init(): void;
  signIn(provider: Provider): Promise<void>;
  signOut(): Promise<void>;
}

export function createAccount(deps: AccountDeps): Account {
  let state: AccountState = GUEST;
  const listeners = new Set<(s: AccountState) => void>();
  let loaded: Promise<Auth | null> | null = null;
  const set = (next: AccountState): void => {
    if (next.signedIn === state.signedIn && next.email === state.email && next.tester === state.tester) return;
    state = next;
    listeners.forEach((cb) => cb(state));
  };
  const load = (): Promise<Auth | null> => {
    loaded ??= deps.loadAuth().then(({ auth, isTester }) => {
      const fromUser = (u: AuthUser): AccountState =>
        u ? { signedIn: true, email: u.email ?? null, tester: isTester(u) } : GUEST;
      auth?.onAuthChange((u) => set(fromUser(u)));
      void auth?.currentUser().then((u) => set(fromUser(u)), () => undefined);
      return auth;
    });
    return loaded;
  };
  return {
    available: deps.configured,
    state: () => state,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    init() {
      if (deps.configured && deps.pending()) void load().catch(() => undefined);
    },
    async signIn(provider) {
      const auth = await load();
      await auth?.signIn(provider);
    },
    async signOut() {
      if (loaded) await (await loaded)?.signOut();
      set(GUEST);
    },
  };
}

function storedSession(): boolean {
  const env = authEnv();
  try {
    return env !== null && localStorage.getItem(sessionKey(env.url)) !== null;
  } catch {
    return false;
  }
}

const returningFromOAuth = (): boolean => typeof location !== 'undefined' && new URLSearchParams(location.search).has('code');

const shared = createAccount({
  configured: authEnv() !== null,
  loadAuth: () => import('./auth').then((m) => ({ auth: m.defaultAuth(), isTester: m.isTester })),
  pending: () => storedSession() || returningFromOAuth(),
});

/** the build's account (the title login entry renders from it) */
export const account: Account = shared;
export const LOGIN_AVAILABLE = shared.available;
export const accountState = (): AccountState => shared.state();
export const onAccountChange = (cb: (s: AccountState) => void): (() => void) => shared.onChange(cb);
export const initAccount = (): void => shared.init();
export const signIn = (provider: Provider): Promise<void> => shared.signIn(provider);
export const signOut = (): Promise<void> => shared.signOut();
