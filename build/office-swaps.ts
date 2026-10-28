// Office build (office spec §10) module swaps: repo-relative v8 module → its office replacement, which keeps
// the same export surface (tests/office/swap.test.ts). Single source of truth for vite.office.config.ts and tests.
// Resolution (build/swap-modules.ts): a replacement importing ITS OWN v8 original gets the original (so it can
// re-export / extend it), but importing any OTHER swapped v8 module gets that module's office version — e.g.
// src/office/render/index.ts → '../../render/index' is v8, while the v8 index's './lasers' is the office lasers.
export const OFFICE_SWAPS: Readonly<Record<string, string>> = {
  'src/flavor.ts': 'src/office/flavor.ts',
  'src/core/content.ts': 'src/office/core/content.ts',
  'src/core/boss.ts': 'src/office/core/boss.ts',
  'src/core/cutscenes.ts': 'src/office/core/cutscenes.ts',
  'src/game/boss-lines.ts': 'src/office/game/boss-lines.ts',
  'src/render/agent.ts': 'src/office/render/agent.ts',
  'src/render/index.ts': 'src/office/render/index.ts',
  'src/render/lasers.ts': 'src/office/render/lasers.ts',
  'src/render/hazards.ts': 'src/office/render/hazards.ts',
  'src/render/gadgets.ts': 'src/office/render/gadgets.ts',
  'src/render/boss-rigs.ts': 'src/office/render/boss-rigs.ts',
  'src/render/doors.ts': 'src/office/render/doors.ts',
  'src/render/popups.ts': 'src/office/render/popups.ts',
  'src/render/photo.ts': 'src/office/render/photo.ts',
  'src/render/post.ts': 'src/office/render/post.ts',
  'src/render/lane-style.ts': 'src/office/render/lane-style.ts',
  'src/audio/music.ts': 'src/office/audio/music.ts',
  'src/audio/sfx.ts': 'src/office/audio/sfx.ts',
  'src/core/achievements.ts': 'src/office/core/achievements.ts',
  'src/core/goals.ts': 'src/office/core/goals.ts',
  'src/ui/moves.ts': 'src/office/ui/moves.ts',
};
