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
  { key: 'sound', label: '효과음', desc: '점프, 코인, 경보 소리', icon: icons.sound, tone: 'sun' },
  { key: 'music', label: '배경음악', desc: '박자에 맞춘 긴장감 넘치는 작전 음악', icon: icons.music, tone: 'pink' },
  { key: 'vibration', label: '진동', desc: '레이저에 닿으면 손끝으로 느껴요', icon: icons.vibrate, tone: 'sky' },
  { key: 'reducedMotion', label: '모션 줄이기', desc: '흔들림과 화려한 효과를 줄여요', icon: icons.sparkle, tone: 'violet' },
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
        h('div', { cls: 'credits__logo', text: '레이저 탈출작전' }),
        h('p', { text: 'LASER ESCAPE v4 · 모든 그래픽과 사운드는 코드로 직접 만들었어요.' }),
        h('p', { cls: 'credits__small', text: 'Agent K, 오늘도 무사히 귀환하길.' }),
      ]),
    ]),
  ]);
}
