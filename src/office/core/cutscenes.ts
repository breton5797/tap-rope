/**
 * Office story (office spec §4; part 2 spec §1) — the office build's src/core/cutscenes.ts (build/office-swaps.ts).
 * - op-start then boss-1 before stage 1 (app.ts replays cutsceneBefore after each one is marked seen),
 *   boss-N before stage N (stages 5 / 10: one shot per section superior), rescue after the first clear of
 *   stage 5 (the 18:00 칼퇴, then the 단톡방 알림 that starts part 2 — v8's id, office story) and escape-end
 *   after the first clear of stage 10 (18:30, the front door).
 * - Hero lines use the speaker HERO ("나"); cutsceneBefore/After swap in the chosen character's name
 *   (save.skin: kid = 칼퇴준, cat = 정시원). The archive replays CUTSCENES as is.
 * - Images: public-office/art/cut/<name>.webp (CUTSCENE_IMAGES, incl. the fail stamp image).
 */
import type { Cutscene, CutsceneId, CutsceneShot, SaveData, SkinId, StageDef } from '../../types';
import { OFFICE_BOSSES, bossFor } from './boss';
import { CHARACTERS } from './characters';

type Frame = CutsceneShot['from'];

/** the player character in CUTSCENES, replaced by the chosen character's name when played */
export const HERO = '나';
const HERO_NAMES: Partial<Record<SkinId, string>> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c.name]));

const img = (name: string) => `./art/cut/${name}.webp`;
const frame = (zoom: number, x = 0.5, y = 0.5): Frame => ({ zoom, x, y });
const shot = (name: string, speaker: string, caption: string, seconds: number, from: Frame, to: Frame): CutsceneShot =>
  ({ image: img(name), speaker, caption, seconds, from, to });

/** the red "야근 확정" stamp screen (result UI, not a cutscene) */
export const FAIL_IMAGE = img('fail');

const superior = (stage: number, section: number | null = null) =>
  OFFICE_BOSSES.find((b) => b.stage === stage && b.section === section) ?? OFFICE_BOSSES[0];

/** single-superior stages (1–4, 6–9): the superior's catchphrase (wide), then the hero's answer (push-in) */
const HERO_ANSWERS: Readonly<Record<number, string>> = {
  1: '저 오늘 약속 있어서요…! 내일 꼭 볼게요!',
  2: '최종본은 내일 아침에 최종으로 보겠습니다!',
  3: '그 5분, 지난주에도 두 시간이었어요…',
  4: '부장님, 저는 6시 땡 세대라서요!',
  6: '설문은… 집에 가서 꼭 할게요! 아마도요!',
  7: '과장님, 저 버스 타요! 반대 방향이에요!',
  8: '영수증은 내일 아침 9시 1분에 드릴게요!',
  9: '이사님, 저 오늘 집밥 예약했어요!',
};

const bossCutscene = (n: number): Cutscene => {
  const boss = superior(n);
  const name = `boss-${n}-a`;
  return {
    id: `boss-${n}` as CutsceneId,
    title: `${boss.name} — ${boss.tag}`,
    shots: [
      shot(name, boss.name, boss.catchphrase, 3, frame(1, 0.5, 0.55), frame(1.1, 0.5, 0.5)),
      shot(name, HERO, HERO_ANSWERS[n] ?? '', 3, frame(1.2, 0.5, 0.42), frame(1.35, 0.5, 0.38)),
    ],
  };
};

/** stages 5 / 10: one shot per section superior (images boss-N-a / -b / -c) */
const finalShot = (stage: 5 | 10, section: 0 | 1 | 2): CutsceneShot => {
  const boss = superior(stage, section);
  return shot(`boss-${stage}-${'abc'[section]}`, boss.name, boss.catchphrase, 3, frame(1, 0.5, 0.55), frame(1.15, 0.5, 0.45));
};

const BOSS_5: Cutscene = {
  id: 'boss-5', title: '임원층 — 전무 · 이사 · 사장님',
  shots: [finalShot(5, 0), finalShot(5, 1), finalShot(5, 2)],
};

const BOSS_10: Cutscene = {
  id: 'boss-10', title: '우리 집 앞 — 팀장 · 전무 · 회장님',
  shots: [finalShot(10, 0), finalShot(10, 1), finalShot(10, 2)],
};

const OP_START: Cutscene = {
  id: 'op-start', title: '17:29, 퇴근 1분 전',
  shots: [
    shot('op-1', HERO, '17:29… 가방은 이미 몰래 싸 뒀다. 오늘은 반드시 정시 퇴근!', 4, frame(1, 0.5, 0.5), frame(1.15, 0.5, 0.4)),
    shot('op-2', '김대리', '어디 가? 잠깐만~ 이것만 좀 봐줄래?', 3.5, frame(1.1, 0.45, 0.5), frame(1.25, 0.55, 0.45)),
  ],
};

/** after stage 5: the part-1 ending, and the group chat that sends the hero on into part 2 */
const RESCUE: Cutscene = {
  id: 'rescue', title: '18:00 칼퇴… 그런데',
  shots: [
    shot('end-1', HERO, '타임카드 18:00:00 찰칵. 칼퇴 성공!', 3.5, frame(1, 0.5, 0.5), frame(1.15, 0.5, 0.45)),
    shot('rescue-1', HERO, '…그런데 단톡방 알림이 울린다. "다들 아직 회사 앞이지?"', 3.5, frame(1.1, 0.5, 0.5), frame(1.3, 0.5, 0.42)),
    shot('rescue-2', HERO, '상사들이 정문으로 몰려온다! 집까지 30분, 다시 달린다!', 3.5, frame(1.2, 0.5, 0.55), frame(1, 0.5, 0.5)),
  ],
};

const ESCAPE_END: Cutscene = {
  id: 'escape-end', title: '18:30 귀가 성공!',
  shots: [
    shot('end-3', HERO, '18:30 현관문 도어락 띠리릭. 집에 왔다!', 3.5, frame(1, 0.5, 0.5), frame(1.15, 0.5, 0.45)),
    shot('end-2', HERO, '소파에 털썩, 만세! …그런데 내일 출근 09:00', 4, frame(1.2, 0.5, 0.6), frame(1, 0.5, 0.5)),
  ],
};

/** story order: opening, superiors 1–5, the part-2 bridge, superiors 6–10, ending */
export const CUTSCENES: readonly Cutscene[] = [
  OP_START, ...[1, 2, 3, 4].map(bossCutscene), BOSS_5, RESCUE, ...[6, 7, 8, 9].map(bossCutscene), BOSS_10, ESCAPE_END,
];

/** every image the story uses (public-office/art/cut/<name>.webp), incl. the fail stamp */
export const CUTSCENE_IMAGES: readonly string[] = [
  ...new Set([...CUTSCENES.flatMap((c) => c.shots.map((s) => s.image)), FAIL_IMAGE].map((p) => p.replace('./art/cut/', '').replace('.webp', ''))),
];

type Seen = Pick<SaveData, 'seenCutscenes'> & { readonly skin?: SkinId };

/** the cutscene with HERO lines spoken by the chosen character (unchanged without a known skin) */
function asPlayed(c: Cutscene, save: Seen): Cutscene {
  const name = save.skin ? HERO_NAMES[save.skin] : undefined;
  if (!name) return c;
  return { ...c, shots: c.shots.map((s) => (s.speaker === HERO ? { ...s, speaker: name } : s)) };
}

const unseen = (id: CutsceneId, save: Seen): Cutscene | null => {
  const c = save.seenCutscenes.includes(id) ? undefined : CUTSCENES.find((x) => x.id === id);
  return c ? asPlayed(c, save) : null;
};

/** the cutscene to play before starting `stage` (first time only), else null */
export function cutsceneBefore(stage: Pick<StageDef, 'id' | 'kind' | 'chapter'>, save: Seen): Cutscene | null {
  const boss = bossFor(stage);
  if (!boss) return null;
  const opening = boss.chapter === 0 ? unseen('op-start', save) : null;
  return opening ?? unseen(`boss-${boss.chapter + 1}` as CutsceneId, save);
}

/** the cutscene to play after a run of `stageId` (first clear of stage 5: rescue, of stage 10: escape-end), else null */
export function cutsceneAfter(stageId: string | null, cleared: boolean, save: Seen): Cutscene | null {
  if (!cleared) return null;
  if (stageId === 'w5-s10') return unseen('rescue', save);
  return stageId === 'w10-s10' ? unseen('escape-end', save) : null;
}
