/**
 * Zone bosses (GDD v7 §1) — a presentation layer over the unchanged v5/v6 beats.
 * - BOSSES: one per zone, fought on the zone's 10th (boss) stage; bossFor() is null everywhere else
 *   (endless and daily never have a boss).
 * - bossView(): hp = 1 − hazards cleared / total; phase = the section the doors put `t` in; state
 *   intro (from INTRO_LEAD before the first hazard beat) → fight → stagger (STAGGER_TIME after each
 *   door) → defeated (after the last beat), with stateAge = seconds since that state began; attack =
 *   the next hazard beat within ATTACK_LEAD, mapped to how the boss delivers it.
 */
import type { Beat, BossAttackKind, BossMeta, BossState, BossView, Door, StageDef } from '../types';
import { HAZARD_KINDS, LANE_HAZARD_KINDS } from '../types';

export const INTRO_LEAD = 2.0;
export const STAGGER_TIME = 1.2;
export const ATTACK_LEAD = 1.6; // telegraph (charge) window before the hazard arrives
const EPS = 1e-9;

export const BOSSES: readonly BossMeta[] = [
  { id: 'warden', chapter: 0, name: '정문 경비대장', codename: 'SENTINEL-01' },
  { id: 'sewer-eye', chapter: 1, name: '수로 감시 드론', codename: 'OCULUS' },
  { id: 'lab-ai', chapter: 2, name: '연구소 보안 AI', codename: 'ARGUS' },
  { id: 'core', chapter: 3, name: '서버 코어', codename: 'NEXUS' },
  { id: 'jailer', chapter: 4, name: '간수장 로봇', codename: 'WARDEN-X' },
  { id: 'apc', chapter: 5, name: '경비대 장갑차', codename: 'RHINO' },
  { id: 'chimera', chapter: 6, name: '실험 병기', codename: 'CHIMERA' },
  { id: 'crane', chapter: 7, name: '공장 크레인·프레스', codename: 'TITAN' },
  { id: 'sniper', chapter: 8, name: '옥상 저격 드론', codename: 'RAVEN' },
  { id: 'gunship', chapter: 9, name: '무장 헬기', codename: 'VULTURE' },
];

type BossStage = Pick<StageDef, 'id' | 'kind' | 'chapter'>;

/** the zone boss on a campaign boss stage ("w{n}-s10"), else null */
export function bossFor(stage: BossStage): BossMeta | null {
  if (stage.kind !== 'boss' || stage.id !== `w${stage.chapter + 1}-s10`) return null;
  return BOSSES[stage.chapter] ?? null;
}

/** the boss of `section` on a boss stage — v8: the zone boss in every section (the office build has one per section on its last stage) */
export function bossForSection(stage: BossStage, _section: number): BossMeta | null {
  return bossFor(stage);
}

const isHazardBeat = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));

/** lane hazards first (lanejump = a lane attack), then beams, ceiling, floor (gate, pulse), drone */
function attackKind(b: Beat): BossAttackKind {
  const has = (...kinds: string[]) => b.obstacles.some((o) => kinds.includes(o.kind));
  if (b.obstacles.some((o) => LANE_HAZARD_KINDS.includes(o.kind))) return 'lane';
  if (has('beam', 'high')) return 'beam';
  if (has('ceiling')) return 'ceiling';
  return has('floor') ? 'floor' : 'drone';
}

function attackAt(hazards: readonly Beat[], t: number): BossView['attack'] {
  const next = hazards.find((b) => b.time >= t - EPS);
  if (!next || next.time - t > ATTACK_LEAD + EPS) return null;
  const kind = attackKind(next);
  return { kind, timeUntil: Math.max(0, next.time - t), lanes: kind === 'lane' ? next.blockedLanes : null };
}

function stateAt(first: number, last: number, doors: readonly Door[], t: number): { state: BossState; stateAge: number } {
  if (t > last) return { state: 'defeated', stateAge: t - last };
  const passed = doors.filter((d) => d.time <= t + EPS);
  const door = passed[passed.length - 1];
  if (door && t < door.time + STAGGER_TIME - EPS) return { state: 'stagger', stateAge: t - door.time };
  if (t < first - EPS) return { state: 'intro', stateAge: Math.max(0, t - (first - INTRO_LEAD)) };
  const since = door ? Math.max(first, door.time + STAGGER_TIME) : first;
  return { state: 'fight', stateAge: t - since };
}

export function bossView(
  stage: BossStage, beats: readonly Beat[], doors: readonly Door[], t: number, hazardDone: number, hazardTotal: number,
): BossView | null {
  const boss = bossFor(stage);
  const hazards = beats.filter(isHazardBeat);
  if (!boss || hazards.length === 0) return null;
  const { state, stateAge } = stateAt(hazards[0].time, beats[beats.length - 1].time, doors, t);
  const phase = Math.min(2, doors.filter((d) => d.time <= t + EPS).length) as BossView['phase'];
  const hp = hazardTotal > 0 ? Math.min(1, Math.max(0, 1 - hazardDone / hazardTotal)) : 1;
  return { id: boss.id, phase, hp, state, stateAge, attack: state === 'defeated' ? null : attackAt(hazards, t) };
}
