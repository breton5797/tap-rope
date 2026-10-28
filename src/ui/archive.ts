// v7 기록 보관소 (cutscene archive) and 업적 (achievements) screens (GDD-v7 §2, §3.1).
// v8: achievement badges, progress (3/10) and ₵ rewards.
import { ACHIEVEMENTS } from '../core/achievements';
import { CUTSCENES } from '../core/cutscenes';
import { ACH_REWARD } from '../core/economy';
import { achievementProgress } from '../core/goals';
import type { AchievementMeta, Cutscene, SaveData } from '../types';
import { h, header, type Ctx } from './dom';
import { icons } from './icons';
import { artImage } from './title';

function archiveCard(ctx: Ctx, c: Cutscene, seen: boolean, i: number): HTMLElement {
  const no = `REC ${String(i + 1).padStart(2, '0')}`;
  const thumb = h('div', { cls: 'arc__thumb' }, [
    seen && c.shots[0] ? artImage(c.shots[0].image, 'art--cut') : h('div', { cls: 'art art--cut' }),
    h('span', { cls: 'arc__no mono', text: no }),
    h('span', { cls: 'arc__icon' }, [seen ? icons.play() : icons.lock()]),
  ]);
  const card = h(
    'button',
    {
      cls: `arc card${seen ? '' : ' is-locked'}`,
      attrs: { type: 'button', 'aria-label': seen ? `${c.title} 재생` : `${no} 미확인 기록`, ...(seen ? {} : { 'aria-disabled': 'true' }) },
    },
    [thumb, h('span', { cls: 'arc__title', text: seen ? c.title : '미확인 기록' }), h('span', { cls: 'arc__len mono', text: seen ? `${c.shots.length} SHOTS` : 'LOCKED' })],
  );
  if (seen) card.addEventListener('click', ctx.tap(() => ctx.cb.onPlayCutscene(c.id)));
  return card;
}

export function buildArchive(ctx: Ctx, save: SaveData, onBack: () => void): HTMLElement {
  const seen = new Set(save.seenCutscenes ?? []);
  const count = CUTSCENES.filter((c) => seen.has(c.id)).length;
  return h('section', { cls: 'screen screen--archive', attrs: { 'aria-label': '기록 보관소' } }, [
    header(ctx, '기록 보관소', onBack, [h('div', { cls: 'chip chip--sm mono', text: `${count}/${CUTSCENES.length}` })], icons.back()),
    h('div', { cls: 'scroll' }, [
      h('p', { cls: 'screen__lead', text: '열람한 작전 기록만 재생 가능. 미확인 기록은 작전 진행 시 해제.' }),
      h('div', { cls: 'arc__grid' }, CUTSCENES.map((c, i) => archiveCard(ctx, c, seen.has(c.id), i))),
    ]),
  ]);
}

/** "2026.10.27" from unix ms (local date). */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** badge patch art (./art/ach/<id>.webp); the check / lock icon stays when it is missing */
function badge(a: AchievementMeta, done: boolean): HTMLElement {
  const box = h('span', { cls: 'ach__icon' }, [done ? icons.check() : icons.lock()]);
  const img = h('img', { cls: 'ach__badge', attrs: { src: `./art/ach/${a.id}.webp`, alt: '', decoding: 'async' } });
  img.addEventListener('load', () => box.replaceChildren(img));
  return box;
}

function achievementRow(a: AchievementMeta, at: number | undefined, save: SaveData): HTMLElement {
  const done = at !== undefined;
  // v8: progress toward cumulative goals ("베테랑 94/150") and the ₵ reward
  const prog = done ? null : achievementProgress(a.id, save);
  const label = `${a.name} — ${done ? `달성 ${formatDate(at)}` : prog ? `진행 ${prog.cur}/${prog.max}` : '미달성'} · 보상 ₵${ACH_REWARD[a.id]}`;
  return h('li', { cls: `ach${done ? ' is-done' : ''}`, attrs: { 'aria-label': label } }, [
    badge(a, done),
    h('div', { cls: 'ach__body' }, [
      h('div', { cls: 'ach__name', text: a.name }),
      h('div', { cls: 'ach__desc', text: a.desc }),
      prog ? h('div', { cls: 'ach__prog', attrs: { 'aria-hidden': 'true' } }, [
        h('span', { cls: 'ach__bar' }, [h('i', { style: { transform: `scaleX(${prog.cur / prog.max})` } })]),
        h('span', { cls: 'ach__count mono', text: `${prog.cur}/${prog.max}` }),
      ]) : null,
    ]),
    h('div', { cls: 'ach__side' }, [
      h('span', { cls: 'ach__date mono', text: done ? formatDate(at) : '—' }),
      h('span', { cls: 'ach__reward mono', text: `₵${ACH_REWARD[a.id]}` }),
    ]),
  ]);
}

export function buildAchievements(ctx: Ctx, save: SaveData, onBack: () => void): HTMLElement {
  const unlocked = save.achievements ?? {};
  const done = ACHIEVEMENTS.filter((a) => unlocked[a.id] !== undefined);
  // unlocked first (newest on top), then locked in catalogue order
  const ordered = [...[...done].sort((a, b) => (unlocked[b.id] ?? 0) - (unlocked[a.id] ?? 0)), ...ACHIEVEMENTS.filter((a) => unlocked[a.id] === undefined)];
  const pct = ACHIEVEMENTS.length === 0 ? 0 : done.length / ACHIEVEMENTS.length;
  return h('section', { cls: 'screen screen--achievements', attrs: { 'aria-label': '업적' } }, [
    header(ctx, '업적', onBack, [h('div', { cls: 'chip chip--sm mono', text: `${done.length}/${ACHIEVEMENTS.length}` })], icons.back()),
    h('div', { cls: 'scroll' }, [
      h('div', { cls: 'ach__summary' }, [
        h('span', { cls: 'kicker', text: 'SERVICE RECORD' }),
        h('div', { cls: 'ach__meter', attrs: { role: 'progressbar', 'aria-label': '업적 달성률', 'aria-valuenow': String(Math.round(pct * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100' } }, [
          h('i', { style: { transform: `scaleX(${pct})` } }),
        ]),
      ]),
      h('ul', { cls: 'ach__list' }, ordered.map((a) => achievementRow(a, unlocked[a.id], save))),
    ]),
  ]);
}
