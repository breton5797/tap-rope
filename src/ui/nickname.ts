// v7 nickname (호출명) card: 2–12 chars of Hangul / Latin / digits / _, inline errors (client + server), submit spinner.
import { button, h, swallowInput, type Ctx } from './dom';

const NAME_RE = /^[가-힣A-Za-z0-9_]{2,12}$/u;

/** Client-side check; null = OK, else a Korean error line. The server still has the final say (taken / banned words). */
export function nicknameError(raw: string): string | null {
  const name = raw.trim();
  if (Array.from(name).length < 2) return '2자 이상 입력.';
  if (Array.from(name).length > 12) return '12자 이하로 입력.';
  if (!NAME_RE.test(name)) return '한글·영문·숫자·_ 만 사용 가능.';
  return null;
}

export function buildNickname(ctx: Ctx, current: string | null, onSubmit: (name: string) => Promise<string | null>, close: () => void): HTMLElement {
  const input = h('input', {
    cls: 'nick__input',
    attrs: { id: 'nick-input', type: 'text', maxlength: '12', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-describedby': 'nick-msg', placeholder: '예: GHOST_07' },
  });
  input.value = current ?? '';
  const msg = h('p', { cls: 'nick__msg', attrs: { id: 'nick-msg', role: 'alert', 'aria-live': 'assertive' }, text: '' });
  const count = h('span', { cls: 'nick__count mono' });
  let busy = false;

  const setError = (text: string | null): void => {
    msg.textContent = text ?? '';
    input.setAttribute('aria-invalid', String(text !== null));
    input.closest('.nick')?.classList.toggle('has-error', text !== null);
  };
  const updateCount = (): void => {
    count.textContent = `${Array.from(input.value.trim()).length}/12`;
  };

  const submit = button({
    label: '등록',
    variant: 'sun',
    size: 'lg',
    cls: 'nick__submit',
    onPress: () => void send(),
  });
  const cancel = button({ label: '나중에', variant: 'ghost', onPress: ctx.tap(() => !busy && close()) });

  async function send(): Promise<void> {
    if (busy) return;
    const name = input.value.trim();
    const local = nicknameError(name);
    if (local) {
      setError(local);
      input.focus();
      return;
    }
    ctx.cb.onUiClick();
    busy = true;
    setError(null);
    submit.classList.add('is-busy');
    submit.setAttribute('aria-busy', 'true');
    submit.disabled = true;
    input.disabled = true;
    let err: string | null;
    try {
      err = await onSubmit(name);
    } catch {
      err = '통신 실패 — 잠시 후 다시 시도.';
    }
    busy = false;
    submit.classList.remove('is-busy');
    submit.removeAttribute('aria-busy');
    submit.disabled = false;
    input.disabled = false;
    if (err) {
      setError(err);
      input.focus();
      input.select();
      return;
    }
    close();
  }

  input.addEventListener('input', () => {
    updateCount();
    if (msg.textContent) setError(null);
  });
  input.addEventListener('keydown', (e) => {
    // typing never reaches the game's key handlers
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      void send();
    } else if (e.key === 'Escape' && !busy) {
      e.preventDefault();
      close();
    }
  });
  updateCount();

  const screen = h('section', { cls: 'screen screen--modal screen--nick', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'nick-title' } }, [
    h('form', { cls: 'nick card pop-in', attrs: { novalidate: '' } }, [
      h('div', { cls: 'kicker', text: 'OPERATOR CALLSIGN' }),
      h('h2', { cls: 'nick__title', text: '호출명 등록', attrs: { id: 'nick-title' } }),
      h('p', { cls: 'nick__lead', text: '랭킹에 표시될 이름. 2–12자, 한글·영문·숫자·_' }),
      h('label', { cls: 'nick__field', attrs: { for: 'nick-input' } }, [h('span', { cls: 'nick__label mono', text: 'CALLSIGN' }), count]),
      input,
      msg,
      h('div', { cls: 'stack' }, [submit, cancel]),
    ]),
  ]);
  screen.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    void send();
  });
  swallowInput(screen);
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
  return screen;
}

