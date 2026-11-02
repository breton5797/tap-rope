// @vitest-environment jsdom
// Office title login (login spec §4): optional — a 로그인 button opening a sheet with Google / Apple, close
// and the privacy line; signed in, a masked email chip and 로그아웃. Builds without login config show nothing.
import { describe, expect, it, vi } from 'vitest';
import type { UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { loginEntry, maskEmail } from '../../src/office/ui/login';
import { GUEST, type Account, type AccountState } from '../../src/office/platform/account';

function ctx(): Ctx {
  const noop = (): void => undefined;
  return { cb: new Proxy({}, { get: () => noop }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true };
}

function fakeAccount(initial: AccountState = GUEST, available = true) {
  let state = initial;
  const subs = new Set<(s: AccountState) => void>();
  const acc: Account = {
    available,
    state: () => state,
    onChange: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    init: () => undefined,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => {
      state = GUEST;
      subs.forEach((cb) => cb(state));
    }),
  };
  const emit = (s: AccountState): void => {
    state = s;
    subs.forEach((cb) => cb(s));
  };
  return { acc, emit };
}

const buttons = (root: ParentNode): string[] => Array.from(root.querySelectorAll('button')).map((b) => b.textContent ?? '');

describe('office login entry', () => {
  it('guest: a 로그인 button opens the sheet (Google, Apple, close, privacy line)', async () => {
    const { acc } = fakeAccount();
    const host = document.createElement('section');
    host.className = 'screen';
    document.body.append(host);
    const el = loginEntry(ctx(), acc) as HTMLElement;
    host.append(el);
    expect(buttons(el)).toEqual(['로그인']);
    el.querySelector('button')?.click();
    const sheet = host.querySelector('.login-sheet') as HTMLElement;
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(buttons(sheet)).toEqual(['Google로 계속하기', 'Apple로 계속하기', '닫기']);
    expect(sheet.textContent).toContain('이메일은 로그인 확인에만 사용해요');
    (sheet.querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(acc.signIn).toHaveBeenCalledWith('apple');
    (sheet.querySelectorAll('button')[2] as HTMLButtonElement).click();
    expect(host.querySelector('.login-sheet')).toBeNull();
    host.remove();
  });

  it('signed in: a masked email chip and 로그아웃; updates live', async () => {
    const { acc, emit } = fakeAccount();
    const el = loginEntry(ctx(), acc) as HTMLElement;
    document.body.append(el);
    emit({ signedIn: true, email: 'breton5797@gmail.com', tester: true });
    expect(el.querySelector('.login__chip')?.textContent).toBe('br***');
    expect(el.querySelector('.login__chip')?.getAttribute('aria-label')).toBe('로그인됨 br***@gmail.com');
    expect(el.textContent).not.toContain('breton5797');
    expect(buttons(el)).toEqual(['로그아웃']);
    el.querySelector('button')?.click();
    await vi.waitFor(() => expect(buttons(el)).toEqual(['로그인']));
    el.remove();
  });

  it('shows nothing in a build without login config', () => {
    expect(loginEntry(ctx(), fakeAccount(GUEST, false).acc)).toBeNull();
  });

  it('masks emails', () => {
    expect(maskEmail('breton5797@gmail.com')).toBe('br***@gmail.com');
    expect(maskEmail('a@x.io')).toBe('a***@x.io');
    expect(maskEmail(null)).toBe('회원');
  });
});
