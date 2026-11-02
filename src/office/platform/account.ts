// Office account (login spec §1–3), swapped in for src/platform/account.ts: optional Google / Apple sign-in.
// Guests never load the auth client: it is imported only when a stored session or an OAuth return (?code=)
// is found at boot, or when the player taps a sign-in button. Tester = the server-set app_metadata flag.
// A failed OAuth return (?error= / #error=, or a ?code= that did not become a session) raises one friendly
// notice; every OAuth return leaves a clean URL (history.replaceState).
import { GUEST, type AccountState, type Provider } from '../../platform/account';
import type { Auth } from './auth';
import { authEnv, sessionKey } from './auth-env';
import { cleanOAuthUrl, oauthReturn } from './oauth-return';

export { GUEST, type AccountState, type Provider };

export const LOGIN_FAILED = '로그인에 실패했어요. 다시 시도해 주세요.';

type AuthUser = Parameters<Parameters<Auth['onAuthChange']>[0]>[0];

export interface AccountDeps {
  readonly configured: boolean;
  readonly loadAuth: () => Promise<{ readonly auth: Auth | null; readonly isTester: (u: AuthUser) => boolean }>;
  /** a stored session is waiting (boot restores it) */
  readonly stored: () => boolean;
  /** the page URL (an OAuth return carries ?code= or an error) */
  readonly href: () => string;
  readonly replaceUrl: (url: string) => void;
}

export interface Account {
  readonly available: boolean;
  state(): AccountState;
  onChange(cb: (s: AccountState) => void): () => void;
  /** a message for the player (a failed sign-in) */
  onNotice(cb: (message: string) => void): () => void;
  init(): void;
  signIn(provider: Provider): Promise<void>;
  signOut(): Promise<void>;
}

export function createAccount(deps: AccountDeps): Account {
  let state: AccountState = GUEST;
  const listeners = new Set<(s: AccountState) => void>();
  const notices = new Set<(message: string) => void>();
  const notify = (m: string): void => notices.forEach((cb) => cb(m));
  let loaded: Promise<{ readonly auth: Auth | null; readonly first: Promise<AuthUser> }> | null = null;
  const set = (next: AccountState): void => {
    if (next.signedIn === state.signedIn && next.email === state.email && next.tester === state.tester) return;
    state = next;
    listeners.forEach((cb) => cb(state));
  };
  const load = (): Promise<{ readonly auth: Auth | null; readonly first: Promise<AuthUser> }> => {
    loaded ??= deps.loadAuth().then(({ auth, isTester }) => {
      const fromUser = (u: AuthUser): AccountState =>
        u ? { signedIn: true, email: u.email ?? null, tester: isTester(u) } : GUEST;
      auth?.onAuthChange((u) => set(fromUser(u)));
      const first = auth ? auth.currentUser().catch(() => null) : Promise.resolve(null);
      void first.then((u) => set(fromUser(u)));
      return { auth, first };
    });
    return loaded;
  };
  /** an OAuth return: report a failure once and clean the URL */
  const settleReturn = (): void => {
    const href = deps.href();
    const back = oauthReturn(href);
    if (back.error) {
      notify(LOGIN_FAILED);
      deps.replaceUrl(cleanOAuthUrl(href));
      return;
    }
    if (!back.code) return;
    load().then(({ first }) => first, () => null).then((u) => {
      if (!u) notify(LOGIN_FAILED);
      deps.replaceUrl(cleanOAuthUrl(deps.href()));
    }, () => undefined);
  };
  return {
    available: deps.configured,
    state: () => state,
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onNotice(cb) {
      notices.add(cb);
      return () => notices.delete(cb);
    },
    init() {
      if (!deps.configured) return;
      settleReturn();
      if (deps.stored()) void load().catch(() => undefined);
    },
    async signIn(provider) {
      const { auth } = await load();
      await auth?.signIn(provider);
    },
    async signOut() {
      if (loaded) await (await loaded).auth?.signOut();
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

const shared = createAccount({
  configured: authEnv() !== null,
  loadAuth: () => import('./auth').then((m) => ({ auth: m.defaultAuth(), isTester: m.isTester })),
  stored: storedSession,
  href: () => location.href,
  replaceUrl: (url) => history.replaceState(history.state, '', url),
});

/** the build's account (the title login entry renders from it) */
export const account: Account = shared;
export const LOGIN_AVAILABLE = shared.available;
export const accountState = (): AccountState => shared.state();
export const onAccountChange = (cb: (s: AccountState) => void): (() => void) => shared.onChange(cb);
export const onAccountNotice = (cb: (message: string) => void): (() => void) => shared.onNotice(cb);
export const initAccount = (): void => shared.init();
export const signIn = (provider: Provider): Promise<void> => shared.signIn(provider);
export const signOut = (): Promise<void> => shared.signOut();
