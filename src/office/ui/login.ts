// Office title login (login spec §4), swapped in for src/ui/login.ts. Login is optional: a 로그인 button
// opens a sheet (Google / Apple, close, privacy line); signed in, a masked email chip and 로그아웃.
// The entry redraws itself on account changes while it is on the page.
import { h, button, swallowInput, type Ctx } from '../../ui/dom';
import { account as shared, type Account, type AccountState, type Provider } from '../platform/account';

const PRIVACY = '이메일은 로그인 확인에만 사용해요';
const FAILED = '로그인을 시작할 수 없어요. 잠시 후 다시 시도해 주세요';

/** "br***@gmail.com" (null = no email shared) */
export function maskEmail(email: string | null): string {
  if (!email) return '회원';
  const at = email.indexOf('@');
  const name = at < 0 ? email : email.slice(0, at);
  return `${name.slice(0, Math.min(2, name.length))}***${at < 0 ? '' : email.slice(at)}`;
}

function sheet(ctx: Ctx, acc: Account, close: () => void): HTMLElement {
  const status = h('p', { cls: 'login-sheet__status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const go = (provider: Provider) => ctx.tap(() => {
    status.textContent = '';
    acc.signIn(provider).catch(() => {
      status.textContent = FAILED;
    });
  });
  const el = h('section', { cls: 'screen screen--modal login-sheet', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '로그인' } }, [
    h('div', { cls: 'modal card pop-in login-sheet__card' }, [
      h('h2', { cls: 'modal__title', text: '로그인' }),
      h('p', { cls: 'modal__text', text: '로그인 없이도 그대로 플레이할 수 있어요.' }),
      h('div', { cls: 'login-sheet__providers' }, [
        button({ label: 'Google로 계속하기', variant: 'glass', cls: 'login-sheet__google', onPress: go('google') }),
        button({ label: 'Apple로 계속하기', variant: 'glass', cls: 'login-sheet__apple', onPress: go('apple') }),
      ]),
      status,
      h('p', { cls: 'login-sheet__privacy', text: PRIVACY }),
      button({ label: '닫기', variant: 'ghost', size: 'sm', cls: 'login-sheet__close', onPress: ctx.tap(close) }),
    ]),
  ]);
  swallowInput(el); // taps on the sheet never reach the game's input
  return el;
}

export function loginEntry(ctx: Ctx, acc: Account = shared): HTMLElement | null {
  if (!acc.available) return null;
  const el = h('div', { cls: 'login' });
  let open: HTMLElement | null = null;
  const close = (): void => {
    open?.remove();
    open = null;
  };
  const render = (s: AccountState): void => {
    if (s.signedIn) close();
    el.replaceChildren(
      ...(s.signedIn
        ? [
          // the chip shows only the masked name (the title's top row is narrow); the full mask is its label
          h('span', { cls: 'chip chip--sm login__chip', attrs: { 'aria-label': `로그인됨 ${maskEmail(s.email)}`, title: maskEmail(s.email) } }, [
            h('span', { text: maskEmail(s.email).split('@')[0] }),
          ]),
          button({ label: '로그아웃', variant: 'glass', size: 'sm', cls: 'login__out', onPress: ctx.tap(() => void acc.signOut()) }),
        ]
        : [button({
          label: '로그인', variant: 'glass', size: 'sm', cls: 'login__in', onPress: ctx.tap(() => {
            close();
            open = sheet(ctx, acc, close);
            // over the whole UI (inside the title screen its animation would trap a fixed overlay)
            (el.closest('#ui') ?? el.closest('.screen') ?? document.body).append(open);
          }),
        })]),
    );
  };
  render(acc.state());
  let seen = false;
  const off = acc.onChange((s) => {
    if (el.isConnected) seen = true;
    else if (seen) {
      off();
      return;
    }
    render(s);
  });
  return el;
}
