// Settings: four toggles. Each change emits a fresh Settings object.
import { COPY, FEATURES } from '../flavor';
import type { SaveData, Settings } from '../types';
import { h, header, type Ctx } from './dom';
import { icons } from './icons';
import { buildTransfer } from './transfer';

interface ToggleDef {
  readonly key: keyof Settings;
  readonly label: string;
  readonly desc: string;
  readonly icon: () => SVGElement;
  readonly tone: string;
}

const TOGGLES: readonly ToggleDef[] = [
  { key: 'sound', label: '효과음', desc: '동작음, 경보, 시스템음', icon: icons.sound, tone: 'sun' },
  { key: 'music', label: '배경음악', desc: COPY.settingsMusicDesc, icon: icons.music, tone: 'sky' },
  { key: 'vibration', label: '진동', desc: '피격 시 진동 피드백', icon: icons.vibrate, tone: 'sky' },
  { key: 'reducedMotion', label: '모션 줄이기', desc: '화면 흔들림·그레인·플래시 해제', icon: icons.sparkle, tone: 'violet' },
];

/** true when the OS asks for reduced motion: the game applies it whatever the setting says */
export function osReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function toggleRow(ctx: Ctx, def: ToggleDef, get: () => Settings, set: (s: Settings) => void): HTMLElement {
  // v8: an OS-forced reduced motion shows as ON and locked, with the reason
  const forced = def.key === 'reducedMotion' && osReducedMotion();
  const on = forced || get()[def.key];
  // v8: the state is spelled out next to the switch (colour alone was ambiguous)
  const state = h('span', { cls: `switch__state mono${on ? ' is-on' : ''}`, text: on ? 'ON' : 'OFF', attrs: { 'aria-hidden': 'true' } });
  const sw = h('button', {
    cls: `switch${on ? ' is-on' : ''}`,
    attrs: { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': def.label, ...(forced ? { 'aria-disabled': 'true' } : {}) },
  }, [h('span', { cls: 'switch__knob' })]);
  const row = h('div', { cls: `setting${forced ? ' is-forced' : ''}` }, [
    h('span', { cls: `setting__icon tone--${def.tone}` }, [def.icon()]),
    h('div', { cls: 'setting__text' }, [
      h('div', { cls: 'setting__label', text: def.label }),
      h('div', { cls: 'setting__desc', text: forced ? '기기 설정에서 켜짐' : def.desc }),
    ]),
    state,
    sw,
  ]);
  if (forced) return row;
  const flip = ctx.tap(() => {
    const next: Settings = { ...get(), [def.key]: !get()[def.key] };
    sw.classList.toggle('is-on', next[def.key]);
    sw.setAttribute('aria-checked', String(next[def.key]));
    state.textContent = next[def.key] ? 'ON' : 'OFF';
    state.classList.toggle('is-on', next[def.key]);
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
      FEATURES.transfer ? buildTransfer(ctx, save) : null,
      h('div', { cls: 'credits' }, [
        h('div', { cls: 'credits__logo mono', text: COPY.creditsLogo }),
        h('p', { text: COPY.creditsLine }),
        h('p', { cls: 'credits__small', text: COPY.creditsSmall }),
      ]),
    ]),
  ]);
}
