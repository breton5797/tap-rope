// v8 settings card "기기 이전 코드": show / copy this device's code, or paste a code from another device
// (save + leaderboard identity), confirm, write it and reload.
import { applyTransfer, decodeTransfer, encodeTransfer, readIdentity, type TransferResult } from '../core/transfer';
import type { SaveData } from '../types';
import { button, h, type Ctx } from './dom';
import { icons } from './icons';

function store(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

async function copy(text: string, area: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    area.select(); // clipboard blocked: leave it selected for a manual copy
    return false;
  }
}

export interface TransferDeps {
  /** reload after a successful import (default: location.reload) */
  readonly reload?: () => void;
}

export function buildTransfer(ctx: Ctx, save: SaveData, deps: TransferDeps = {}): HTMLElement {
  const status = h('p', { cls: 'transfer__status', attrs: { role: 'status', 'aria-live': 'polite' } });
  const say = (msg: string, tone: 'ok' | 'err' | '' = ''): void => {
    status.textContent = msg;
    status.className = `transfer__status${tone ? ` is-${tone}` : ''}`;
  };
  const out = h('textarea', { cls: 'transfer__code mono', attrs: { readonly: '', rows: '3', 'aria-label': '이 기기의 이전 코드', spellcheck: 'false' } });
  const input = h('textarea', { cls: 'transfer__code mono', attrs: { rows: '3', 'aria-label': '가져올 이전 코드', placeholder: 'LE2.… 코드를 붙여 넣기', spellcheck: 'false', autocapitalize: 'off' } });
  // typing must not reach the game's window key bindings (space / arrows would be swallowed)
  for (const area of [out, input]) area.addEventListener('keydown', (e) => e.stopPropagation());
  let pending: Extract<TransferResult, { ok: true }> | null = null;
  const confirm = button({
    label: '덮어쓰고 다시 시작', variant: 'pink', size: 'sm', cls: 'transfer__confirm',
    onPress: ctx.tap(() => {
      if (!pending) return;
      if (!applyTransfer(pending, store())) {
        say('저장 공간에 쓸 수 없어요. 개인 정보 보호 모드인지 확인해 주세요.', 'err');
        return;
      }
      say('가져오기 완료. 다시 시작합니다…', 'ok');
      (deps.reload ?? (() => location.reload()))();
    }),
  });
  // .btn sets display, so the [hidden] attribute alone would not hide it
  const showConfirm = (on: boolean): void => {
    confirm.style.display = on ? '' : 'none';
  };
  showConfirm(false);

  const show = button({
    label: '코드 만들기', variant: 'glass', size: 'sm', icon: icons.transfer(),
    onPress: ctx.tap(() => {
      const code = encodeTransfer(save, readIdentity(store()));
      out.value = code;
      out.hidden = false;
      void copy(code, out).then((ok) => say(ok ? '복사했어요. 새 기기의 설정 → 가져오기에 붙여 넣으세요.' : '코드를 길게 눌러 복사하세요.', 'ok'));
    }),
  });
  out.hidden = true;

  const check = button({
    label: '가져오기', variant: 'glass', size: 'sm',
    onPress: ctx.tap(() => {
      const r = decodeTransfer(input.value);
      if (!r.ok) {
        pending = null;
        showConfirm(false);
        say(r.error, 'err');
        return;
      }
      pending = r;
      const stars = Object.values(r.save.stars).reduce((n, s) => n + s, 0);
      const who = r.identity?.nickname ? ` · 호출부호 ${r.identity.nickname}` : '';
      say(`별 ${stars}개 · ₵${r.save.coins}${who}. 이 기기의 진행은 덮어써져요.`, '');
      showConfirm(true);
    }),
  });

  return h('div', { cls: 'card transfer' }, [
    h('div', { cls: 'transfer__head' }, [
      h('span', { cls: 'setting__icon tone--sky' }, [icons.transfer()]),
      h('div', { cls: 'setting__text' }, [
        h('div', { cls: 'setting__label', text: '기기 이전 코드' }),
        h('div', { cls: 'setting__desc', text: '진행 상황과 랭킹 호출부호를 다른 기기로 옮겨요. 코드는 비밀번호처럼 보관하세요.' }),
      ]),
    ]),
    h('div', { cls: 'row transfer__row' }, [show]),
    out,
    input,
    h('div', { cls: 'row transfer__row' }, [check, confirm]),
    status,
  ]);
}
