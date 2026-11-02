// Office login review fix: an OAuth return that failed (?error= / #error=, or a ?code= the client could not
// exchange) shows a friendly notice once and leaves a clean URL; a good return also loses its ?code=.
import { describe, expect, it, vi } from 'vitest';
import { cleanOAuthUrl, oauthReturn } from '../../src/office/platform/oauth-return';
import { createAccount, GUEST, LOGIN_FAILED } from '../../src/office/platform/account';
import type { Auth } from '../../src/office/platform/auth';

const BASE = 'https://breton5797.github.io/tap-rope/office/';

describe('oauth return parsing', () => {
  it('reads errors from the query or the hash, and a code from the query', () => {
    expect(oauthReturn(`${BASE}?error=access_denied&error_description=denied`)).toEqual({ error: true, code: false });
    expect(oauthReturn(`${BASE}#error=server_error&error_code=500&error_description=x`)).toEqual({ error: true, code: false });
    expect(oauthReturn(`${BASE}?code=abc`)).toEqual({ error: false, code: true });
    expect(oauthReturn(`${BASE}?autoplay=1`)).toEqual({ error: false, code: false });
  });

  it('strips only the OAuth parameters', () => {
    expect(cleanOAuthUrl(`${BASE}?autoplay=1&code=abc&state=s`)).toBe(`${BASE}?autoplay=1`);
    expect(cleanOAuthUrl(`${BASE}?error=a&error_code=b&error_description=c`)).toBe(BASE);
    expect(cleanOAuthUrl(`${BASE}#error=a&error_description=c`)).toBe(BASE);
    expect(cleanOAuthUrl(`${BASE}#stage`)).toBe(`${BASE}#stage`);
  });
});

function setup(href: string, user: unknown, stored = false) {
  const replaced: string[] = [];
  const auth: Auth = {
    signIn: vi.fn(async () => undefined), signOut: vi.fn(async () => undefined),
    onAuthChange: () => () => undefined, currentUser: async () => user as never,
  };
  const loadAuth = vi.fn(async () => ({ auth, isTester: () => false }));
  const acc = createAccount({ configured: true, loadAuth, stored: () => stored, href: () => href, replaceUrl: (u) => replaced.push(u) });
  const notices: string[] = [];
  acc.onNotice((m) => notices.push(m));
  return { acc, loadAuth, replaced, notices };
}

describe('account on an OAuth return', () => {
  it('?error= / #error=: a friendly notice and a clean URL, no auth client needed', () => {
    for (const href of [`${BASE}?error=access_denied&error_description=x`, `${BASE}#error=access_denied&error_description=x`]) {
      const { acc, loadAuth, replaced, notices } = setup(href, null);
      acc.init();
      expect(notices).toEqual([LOGIN_FAILED]);
      expect(LOGIN_FAILED).toBe('로그인에 실패했어요. 다시 시도해 주세요.');
      expect(replaced).toEqual([BASE]);
      expect(loadAuth).not.toHaveBeenCalled();
      expect(acc.state()).toEqual(GUEST);
    }
  });

  it('a ?code= that did not become a session: the notice, and ?code= is stripped', async () => {
    const { acc, replaced, notices } = setup(`${BASE}?code=bad`, null);
    acc.init();
    await vi.waitFor(() => expect(notices).toEqual([LOGIN_FAILED]));
    expect(replaced).toEqual([BASE]);
  });

  it('a good ?code= signs in quietly and still leaves a clean URL', async () => {
    const { acc, replaced, notices } = setup(`${BASE}?code=good`, { email: 'm@x.io', app_metadata: {} });
    acc.init();
    await vi.waitFor(() => expect(acc.state().signedIn).toBe(true));
    expect(notices).toEqual([]);
    expect(replaced).toEqual([BASE]);
  });
});
