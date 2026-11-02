// Account seam (office login spec §2): who is playing — a guest, a signed-in member, or a tester. v8 has no
// login: always a guest, never a tester. The office build swaps in src/office/platform/account.ts.
export type Provider = 'google' | 'apple';

export interface AccountState {
  readonly signedIn: boolean;
  readonly email: string | null;
  /** server-granted (app_metadata.office_tester): invincible runs, every stage open, nothing recorded */
  readonly tester: boolean;
}

export const GUEST: AccountState = { signedIn: false, email: null, tester: false };

/** v8: no sign-in UI */
export const LOGIN_AVAILABLE = false;

export function accountState(): AccountState {
  return GUEST;
}

export function onAccountChange(_cb: (s: AccountState) => void): () => void {
  return () => undefined;
}

/** messages for the player, e.g. a failed sign-in (v8: none) */
export function onAccountNotice(_cb: (message: string) => void): () => void {
  return () => undefined;
}

/** restore a stored session at boot (v8: nothing) */
export function initAccount(): void {}

export async function signIn(_provider: Provider): Promise<void> {}

export async function signOut(): Promise<void> {}
