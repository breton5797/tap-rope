/**
 * 이번 주 이벤트: six themes rotate by week (weekIndex). A theme dresses the daily mission (presentation, pickup
 * share, the collect item, the superior of most days, a focus move the player already knows) and sets one
 * weekly goal that every office run counts toward. Never a difficulty knob (spec §3).
 */
import type { GoalProgress, LiveRunCounts, ThemeId, WeekKey, WeekTheme } from './types';
import { weekIndex } from './dates';

/** BALANCE knob: points for a completed weekly goal */
export const GOAL_POINTS = 150;

const theme = (t: Omit<WeekTheme, 'goal'> & { goal: Omit<WeekTheme['goal'], 'points'> }): WeekTheme =>
  ({ ...t, goal: { ...t.goal, points: GOAL_POINTS } });

/** rotation order (week 0 of the rotation = the first entry) */
export const THEMES: readonly WeekTheme[] = [
  theme({
    id: 'monday-blues', name: '월요병 주간', desc: '커피가 평소보다 자주 나와요. 커피로 월요병을 이겨 내자!',
    emphasis: { pickupMul: 1.6, collectible: 'coupon' },
    goal: { metric: 'coffee', target: 30, label: '커피 30잔 모으기', cosmetic: 'trail-coffee' },
  }),
  theme({
    id: 'dodge-dinner', name: '회식 피하기 주간', desc: '윤이사가 자주 나타나요. "2차 가자!"를 피해라!',
    emphasis: { boss: 'apc' },
    goal: { metric: 'dodge-dinner', target: 40, label: '회식 공격 40번 피하기', cosmetic: 'card-dinner' },
  }),
  theme({
    id: 'paper-bomb', name: '결재 폭탄 주간', desc: '서류가 쏟아지는 한 주. 흩날린 서류를 모아 결재를 끝내자!',
    emphasis: { collectible: 'docs', boss: 'jailer', focus: ['beam', 'double'] },
    goal: { metric: 'docs', target: 50, label: '서류 50장 모으기', cosmetic: 'trail-paper' },
  }),
  theme({
    id: 'speed-clockout', name: '칼퇴 스피드 주간', desc: '시계가 째깍째깍! 박자에 딱 맞춰 칼퇴하자.',
    emphasis: { fx: { clock: true } },
    goal: { metric: 'perfects', target: 200, label: 'PERFECT 200번', cosmetic: 'stamp-clock' },
  }),
  theme({
    id: 'sports-day', name: '사내 체육대회 주간', desc: '점프, 또 점프! 체육대회 메달을 노려라.',
    emphasis: { focus: ['jump', 'double'] },
    goal: { metric: 'jumps', target: 150, label: '점프 150번', cosmetic: 'jump-medal' },
  }),
  theme({
    id: 'rainy-commute', name: '비 오는 퇴근길 주간', desc: '퇴근길에 비가 와요. 우산 쓰고 집까지!',
    emphasis: { fx: { rain: true } },
    goal: { metric: 'part2-clears', target: 3, label: '2부 단계 3번 클리어', cosmetic: 'trail-rain' },
  }),
];

const BY_ID: ReadonlyMap<ThemeId, WeekTheme> = new Map(THEMES.map((t) => [t.id, t]));
export const themeById = (id: ThemeId): WeekTheme | undefined => BY_ID.get(id);

/** the theme of `week` (rotation by weekIndex) */
export function themeOf(week: WeekKey): WeekTheme {
  const n = THEMES.length;
  return THEMES[((weekIndex(week) % n) + n) % n];
}

/** the goal progress after a run (a new week starts at 0; done is sticky, value stops at the target) */
export function addGoalProgress(prev: GoalProgress | null, week: WeekKey, counts: LiveRunCounts): GoalProgress {
  const goal = themeOf(week).goal;
  const base = prev && prev.week === week ? prev : { week, value: 0, done: false };
  const value = Math.min(goal.target, base.value + Math.max(0, Math.floor(counts[goal.metric] ?? 0)));
  return { week, value, done: base.done || value >= goal.target };
}
