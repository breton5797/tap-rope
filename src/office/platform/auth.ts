// Office sign-in (login spec §2): Supabase Auth only — Google / Apple OAuth with PKCE, the session kept
// in localStorage under supabase-js's usual key. It is the bare auth client (@supabase/auth-js, the auth
// part of supabase-js): no database, storage, realtime or functions client ships, so no game data can go
// to the server. The tester flag is read from the server-signed app_metadata. Loaded on demand
// (account.ts), so guests never download it.
import { AuthClient, type GoTrueClientOptions, type User } from '@supabase/auth-js';
import type { Provider } from '../../platform/account';
import { authEnv, redirectTo, sessionKey, type AuthEnv } from './auth-env';

type Client = Pick<InstanceType<typeof AuthClient>, 'signInWithOAuth' | 'signOut' | 'onAuthStateChange' | 'getSession'>;
type Make = (opts: GoTrueClientOptions) => Client;

const makeClient: Make = (opts) => new AuthClient(opts);

/** app_metadata is writable only by the server (DB trigger, login spec §3) and signed into the JWT */
export function isTester(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.office_tester === true;
}

export interface Auth {
  signIn(provider: Provider): Promise<void>;
  signOut(): Promise<void>;
  onAuthChange(cb: (user: User | null) => void): () => void;
  currentUser(): Promise<User | null>;
}

export function createAuth(env: AuthEnv, make: Make = makeClient, loc: Pick<Location, 'origin' | 'pathname'> = location): Auth {
  const client = make({
    url: `${env.url.replace(/\/$/, '')}/auth/v1`,
    headers: { apikey: env.key },
    storageKey: sessionKey(env.url),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  });
  return {
    async signIn(provider) {
      const { error } = await client.signInWithOAuth({ provider, options: { redirectTo: redirectTo(loc) } });
      if (error) throw error;
    },
    async signOut() {
      await client.signOut();
    },
    onAuthChange(cb) {
      const { data } = client.onAuthStateChange((_event, session) => cb(session?.user ?? null));
      return () => data.subscription.unsubscribe();
    },
    async currentUser() {
      const { data } = await client.getSession();
      return data.session?.user ?? null;
    },
  };
}

let shared: Auth | null = null;

/** the build's auth client (null when this build has no login config) */
export function defaultAuth(): Auth | null {
  const env = authEnv();
  if (!env) return null;
  shared ??= createAuth(env);
  return shared;
}
