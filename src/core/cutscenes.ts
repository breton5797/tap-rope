/**
 * Story cutscenes (GDD v7 §2): 13 short Ken Burns sequences in an operations-report voice.
 * - op-start before 1-1, boss-N before N-10 (instead of the briefing), rescue after clearing 5-10,
 *   escape-end after clearing 10-10. Each plays automatically once (save.seenCutscenes); the archive
 *   replays seen ones.
 * - Images live in public/art/cut/<name>.webp (CUTSCENE_IMAGES, 19 files). A boss cutscene uses one image
 *   twice: the wide silhouette, then a push-in to the boss's front.
 */
import type { Cutscene, CutsceneId, CutsceneShot, SaveData, StageDef } from '../types';
import { BOSSES, bossFor } from './boss';

type Frame = CutsceneShot['from'];
type Speaker = '본부' | '요원' | '포로';

const img = (name: string) => `./art/cut/${name}.webp`;
const frame = (zoom: number, x = 0.5, y = 0.5): Frame => ({ zoom, x, y });
const shot = (name: string, speaker: Speaker, caption: string, seconds: number, from: Frame, to: Frame): CutsceneShot =>
  ({ image: img(name), speaker, caption, seconds, from, to });

/** [first line (본부, wide silhouette), second line (요원, push-in)] per zone boss */
const BOSS_LINES: readonly (readonly [string, string])[] = [
  ['정문에 중장갑 경비 메크 확인.', '팔 레이저포와 발 구르기에 주의. 돌파한다.'],
  ['수로 상공에 대형 감시 드론.', '탐조등 스캔 범위 밖으로 이동한다.'],
  ['연구소 보안 AI 가동.', '천장 포탑 배열 확인. 차단선을 통과한다.'],
  ['서버 코어 방어 체계 작동.', '격자 레이저 패턴 분석 완료. 진입한다.'],
  ['간수장 로봇이 감방 구역을 막고 있다.', '방패 돌진 경로를 피해 포로에게 간다.'],
  ['후방에서 경비대 장갑차 추격.', '포로 확보 상태. 속도를 유지한다.'],
  ['격리 해제된 실험 병기 확인.', '도약 착지 지점을 피해 출구로 간다.'],
  ['크레인과 프레스 연동 가동.', '화물 낙하 구간을 돌파한다.'],
  ['옥상 상공에 저격 드론.', '조준선 확인 즉시 회피한다.'],
  ['무장 헬기 접근.', '헬리패드까지 최종 돌파.'],
];

const bossCutscene = (n: number): Cutscene => {
  const boss = BOSSES[n - 1];
  const [hq, agent] = BOSS_LINES[n - 1];
  const name = `boss-${n}-a`;
  return {
    id: `boss-${n}` as CutsceneId,
    title: `${boss.codename} — ${boss.name}`,
    shots: [
      shot(name, '본부', `${hq} 코드명 ${boss.codename}.`, 3, frame(1, 0.5, 0.55), frame(1.1, 0.5, 0.5)),
      shot(name, '요원', agent, 3, frame(1.2, 0.5, 0.42), frame(1.35, 0.5, 0.38)),
    ],
  };
};

const OP_START: Cutscene = {
  id: 'op-start', title: '작전 개시',
  shots: [
    shot('op-1', '본부', '목표 기지 확인. 억류 인원 1명, 외곽 경비 다수.', 4, frame(1, 0.5, 0.5), frame(1.15, 0.5, 0.4)),
    shot('op-2', '요원', '장비 점검 완료. 침투를 개시한다.', 3, frame(1.1, 0.45, 0.5), frame(1.2, 0.55, 0.5)),
    shot('op-3', '본부', '외곽 레이저 경계선 활성. 타이밍을 맞춰 통과하라.', 3.5, frame(1.2, 0.5, 0.6), frame(1, 0.5, 0.5)),
  ],
};

const RESCUE: Cutscene = {
  id: 'rescue', title: '포로 구출',
  shots: [
    shot('rescue-1', '요원', '감방 잠금 해제.', 3, frame(1, 0.5, 0.5), frame(1.15, 0.5, 0.45)),
    shot('rescue-2', '포로', '구조대인가. 걸을 수 있다.', 3.5, frame(1.15, 0.4, 0.5), frame(1.25, 0.5, 0.45)),
    shot('rescue-3', '본부', '포로 확보 확인. 탈출 경로 확보.', 3.5, frame(1.1, 0.5, 0.55), frame(1, 0.5, 0.5)),
  ],
};

const ESCAPE_END: Cutscene = {
  id: 'escape-end', title: '임무 완료',
  shots: [
    shot('end-1', '요원', '포로와 함께 탑승 완료.', 3, frame(1, 0.5, 0.5), frame(1.12, 0.5, 0.45)),
    shot('end-2', '본부', '이륙 확인. 추격 없음.', 3.5, frame(1.2, 0.5, 0.6), frame(1, 0.5, 0.5)),
    shot('end-3', '본부', '임무 완료. 귀환하라.', 4, frame(1, 0.5, 0.5), frame(1.08, 0.5, 0.5)),
  ],
};

const bosses = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => bossCutscene(from + i));

/** story order: op-start, bosses 1–5, rescue, bosses 6–10, escape-end */
export const CUTSCENES: readonly Cutscene[] = [OP_START, ...bosses(1, 5), RESCUE, ...bosses(6, 10), ESCAPE_END];

/** every image the cutscenes use (public/art/cut/<name>.webp) */
export const CUTSCENE_IMAGES: readonly string[] = [
  ...new Set(CUTSCENES.flatMap((c) => c.shots.map((s) => s.image.replace('./art/cut/', '').replace('.webp', '')))),
];

type Seen = Pick<SaveData, 'seenCutscenes'>;

const unseen = (id: CutsceneId, save: Seen): Cutscene | null =>
  (save.seenCutscenes.includes(id) ? null : CUTSCENES.find((c) => c.id === id) ?? null);

/** the cutscene to play before starting `stage` (first time only), else null */
export function cutsceneBefore(stage: Pick<StageDef, 'id' | 'kind' | 'chapter'>, save: Seen): Cutscene | null {
  if (stage.id === 'w1-s1') return unseen('op-start', save);
  const boss = bossFor(stage);
  return boss ? unseen(`boss-${boss.chapter + 1}` as CutsceneId, save) : null;
}

/** the cutscene to play after a run of `stageId` (first clear of 5-10 / 10-10 only), else null */
export function cutsceneAfter(stageId: string | null, cleared: boolean, save: Seen): Cutscene | null {
  if (!cleared) return null;
  if (stageId === 'w5-s10') return unseen('rescue', save);
  return stageId === 'w10-s10' ? unseen('escape-end', save) : null;
}
