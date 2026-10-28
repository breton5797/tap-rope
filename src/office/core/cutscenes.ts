/**
 * Office story (office spec §4) — the office build's src/core/cutscenes.ts (build/office-swaps.ts).
 * - op-start then boss-1 before stage 1 (app.ts replays cutsceneBefore after each one is marked seen),
 *   boss-N before stage N (stage 5: 한전무 → 윤이사 → 사장님, one shot each), escape-end after the first
 *   clear of stage 5. v8's rescue and boss-6..10 do not exist here, so they never play or count.
 * - Hero lines use the speaker HERO ("나"); cutsceneBefore/After swap in the chosen character's name
 *   (save.skin: kid = 칼퇴준, cat = 정시원). The archive replays CUTSCENES as is.
 * - Images: public-office/art/cut/<name>.webp (CUTSCENE_IMAGES, incl. the fail stamp image).
 */
import type { Cutscene, CutsceneId, CutsceneShot, SaveData, SkinId, StageDef } from '../../types';
import { OFFICE_BOSSES, bossFor } from './boss';

type Frame = CutsceneShot['from'];

/** the player character in CUTSCENES, replaced by the chosen character's name when played */
export const HERO = '나';
const HERO_NAMES: Partial<Record<SkinId, string>> = { kid: '칼퇴준', cat: '정시원' };

const img = (name: string) => `./art/cut/${name}.webp`;
const frame = (zoom: number, x = 0.5, y = 0.5): Frame => ({ zoom, x, y });
const shot = (name: string, speaker: string, caption: string, seconds: number, from: Frame, to: Frame): CutsceneShot =>
  ({ image: img(name), speaker, caption, seconds, from, to });

/** the red "야근 확정" stamp screen (result UI, not a cutscene) */
export const FAIL_IMAGE = img('fail');

const superior = (stage: number, section: number | null = null) =>
  OFFICE_BOSSES.find((b) => b.stage === stage && b.section === section) ?? OFFICE_BOSSES[0];

/** stages 1–4: the superior's catchphrase (wide), then the hero's answer (push-in) */
const HERO_ANSWERS: readonly string[] = [
  '저 오늘 약속 있어서요…! 내일 꼭 볼게요!',
  '최종본은 내일 아침에 최종으로 보겠습니다!',
  '그 5분, 지난주에도 두 시간이었어요…',
  '부장님, 저는 6시 땡 세대라서요!',
];

const bossCutscene = (n: number): Cutscene => {
  const boss = superior(n);
  const name = `boss-${n}-a`;
  return {
    id: `boss-${n}` as CutsceneId,
    title: `${boss.name} — ${boss.tag}`,
    shots: [
      shot(name, boss.name, boss.catchphrase, 3, frame(1, 0.5, 0.55), frame(1.1, 0.5, 0.5)),
      shot(name, HERO, HERO_ANSWERS[n - 1], 3, frame(1.2, 0.5, 0.42), frame(1.35, 0.5, 0.38)),
    ],
  };
};

const finalShot = (section: 0 | 1 | 2, image: string): CutsceneShot => {
  const boss = superior(5, section);
  return shot(image, boss.name, boss.catchphrase, 3, frame(1, 0.5, 0.55), frame(1.15, 0.5, 0.45));
};

const BOSS_5: Cutscene = {
  id: 'boss-5', title: '임원층 — 전무 · 이사 · 사장님',
  shots: [finalShot(0, 'boss-5-a'), finalShot(1, 'boss-5-b'), finalShot(2, 'boss-5-c')],
};

const OP_START: Cutscene = {
  id: 'op-start', title: '17:29, 퇴근 1분 전',
  shots: [
    shot('op-1', HERO, '17:29… 가방은 이미 몰래 싸 뒀다. 오늘은 반드시 정시 퇴근!', 4, frame(1, 0.5, 0.5), frame(1.15, 0.5, 0.4)),
    shot('op-2', '김대리', '어디 가? 잠깐만~ 이것만 좀 봐줄래?', 3.5, frame(1.1, 0.45, 0.5), frame(1.25, 0.55, 0.45)),
  ],
};

const ESCAPE_END: Cutscene = {
  id: 'escape-end', title: '칼퇴 성공!',
  shots: [
    shot('end-1', HERO, '타임카드 18:00:00 찰칵. 칼퇴 성공!', 3.5, frame(1, 0.5, 0.5), frame(1.15, 0.5, 0.45)),
    shot('end-2', HERO, '노을 아래 만세! …그런데 내일 출근 09:00', 4, frame(1.2, 0.5, 0.6), frame(1, 0.5, 0.5)),
  ],
};

/** story order: opening, superiors 1–5, ending */
export const CUTSCENES: readonly Cutscene[] = [OP_START, ...[1, 2, 3, 4].map(bossCutscene), BOSS_5, ESCAPE_END];

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

/** the cutscene to play after a run of `stageId` (first clear of stage 5 only), else null */
export function cutsceneAfter(stageId: string | null, cleared: boolean, save: Seen): Cutscene | null {
  return cleared && stageId === 'w5-s10' ? unseen('escape-end', save) : null;
}
