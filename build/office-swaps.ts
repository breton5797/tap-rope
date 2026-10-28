// Office build (office spec §10) module swaps: repo-relative v8 module → its office replacement, which keeps
// the same export surface (tests/office/swap.test.ts). Single source of truth for vite.office.config.ts and tests.
export const OFFICE_SWAPS: Readonly<Record<string, string>> = {
  'src/flavor.ts': 'src/office/flavor.ts',
  'src/core/content.ts': 'src/office/core/content.ts',
  'src/core/boss.ts': 'src/office/core/boss.ts',
  'src/core/cutscenes.ts': 'src/office/core/cutscenes.ts',
  'src/game/boss-lines.ts': 'src/office/game/boss-lines.ts',
  'src/render/agent.ts': 'src/office/render/agent.ts',
  'src/audio/music.ts': 'src/office/audio/music.ts',
};
