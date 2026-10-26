// Settings: four toggles. Each change emits a fresh Settings object.
import type { SaveData, Settings } from '../types';
import { h, header, type Ctx } from './dom';
import { icons } from './icons';

interface ToggleDef {
  readonly key: keyof Settings;
  readonly label: string;
  readonly desc: string;
  readonly icon: () => SVGElement;
  readonly tone: string;
}

const TOGGLES: readonly ToggleDef[] = [
  { key: 'sound', label: '효과음', desc: '동작음, 경보, 시스템음', icon: icons.sound, tone: 'sun' },
  { key: 'music', label: '배경음악', desc: '작전 박자에 맞춘 신스 트랙', icon: icons.music, tone: 'sky' },
  { key: 'vibration', label: '진동', desc: '피격 시 진동 피드백', icon: icons.vibrate, tone: 'sky' },
  { key: 'reducedMotion', label: '모션 줄이기', desc: '화면 흔들림·그레인·플래시 해제', icon: icons.sparkle, tone: 'violet' },
];

function toggleRow(ctx: Ctx, def: ToggleDef, get: () => Settings, set: (s: Settings) => void): HTMLElement {
  const on = get()[def.key];
  const sw = h('button', {
    cls: `switch${on ? ' is-on' : ''}`,
    attrs: { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': def.label },
  }, [h('span', { cls: 'switch__knob' })]);
  const row = h('div', { cls: 'setting' }, [
    h('span', { cls: `setting__icon tone--${def.tone}` }, [def.icon()]),
    h('div', { cls: 'setting__text' }, [h('div', { cls: 'setting__label', text: def.label }), h('div', { cls: 'setting__desc', text: def.desc })]),
    sw,
  ]);
  const flip = ctx.tap(() => {
    const next: Settings = { ...get(), [def.key]: !get()[def.key] };
    sw.classList.toggle('is-on', next[def.key]);
    sw.setAttribute('aria-checked', String(next[def.key]));
    set(next);
  });
  row.addEventListener('click', flip);
  return row;
}

export function buildSettings(ctx: Ctx, save: SaveData, onBack: () => void, onLocalChange: (s: Settings) => void): HTMLElement {
  let current = save.settings;
  const set = (s: Settings): void => {
    current = s;
    onLocalChange(s);
    ctx.cb.onSettingsChange(s);
  };
  return h('section', { cls: 'screen screen--settings', attrs: { 'aria-label': '설정' } }, [
    header(ctx, '설정', onBack, [], icons.back()),
    h('div', { cls: 'scroll' }, [
      h('div', { cls: 'card settings' }, TOGGLES.map((d) => toggleRow(ctx, d, () => current, set))),
      h('div', { cls: 'credits' }, [
        h('div', { cls: 'credits__logo mono', text: 'LASER ESCAPE // 레이저 탈출작전' }),
        h('p', { text: 'v6 · 사운드 전량 절차 합성. 시설 사진은 로컬 생성 이미지.' }),
        h('p', { cls: 'credits__small', text: '통신 종료. 무사 귀환 바람.' }),
      ]),
    ]),
  ]);
}
