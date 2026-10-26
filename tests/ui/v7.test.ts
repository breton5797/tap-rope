// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUi } from '../../src/ui/index';
import { buildCutscene, DISSOLVE_MS, kenBurns } from '../../src/ui/cutscene';
import { nicknameError } from '../../src/ui/nickname';
import type { Cutscene, HudState, UiCallbacks } from '../../src/types';

function callbacks(): UiCallbacks {
  const noop = (): void => undefined;
  return {
    onStartStage: noop, onStartEndless: noop, onStartDaily: noop, onPause: noop, onResume: noop, onRetry: noop,
    onQuit: noop, onNextStage: noop, onBuySkin: noop, onSelectSkin: noop, onSettingsChange: noop, onTutorialDone: noop,
    onUiClick: vi.fn(), onOpenArchive: vi.fn(), onPlayCutscene: vi.fn(), onOpenAchievements: vi.fn(), onOpenLeaderboard: vi.fn(), onOpenNickname: vi.fn(),
  };
}

const SCENE: Cutscene = {
  id: 'op-start',
  title: 'TEST',
  shots: [
    { image: './art/cut/a.webp', caption: '첫 번째.', speaker: '본부', seconds: 2, from: { zoom: 1.1, x: 0.5, y: 0.5 }, to: { zoom: 1.2, x: 0.4, y: 0.6 } },
    { image: './art/cut/b.webp', caption: '두 번째.', seconds: 3, from: { zoom: 1, x: 0.5, y: 0.5 }, to: { zoom: 1.15, x: 0.5, y: 0.3 } },
  ],
};

describe('cutscene player', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function mount(reduced = false) {
    const onDone = vi.fn();
    const player = buildCutscene(SCENE, { reduced, onClick: () => undefined }, onDone);
    document.body.appendChild(player.el);
    return { onDone, player };
  }

  it('plays every shot, then calls onDone exactly once and removes itself', () => {
    const { onDone, player } = mount();
    expect(player.el.querySelector('.cut__count')?.textContent).toBe('01/02');
    vi.advanceTimersByTime(2000);
    expect(player.el.querySelector('.cut__count')?.textContent).toBe('02/02');
    expect(player.el.querySelector('.cut__speaker')?.hasAttribute('hidden')).toBe(true);
    vi.advanceTimersByTime(3000 + DISSOLVE_MS + 10);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(player.el.isConnected).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('SKIP button, Escape and a late timer all end it once', () => {
    const { onDone, player } = mount();
    const btn = player.el.querySelector<HTMLButtonElement>('.cut__skip');
    btn?.click();
    btn?.click(); // double-tap
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    player.el.dispatchEvent(new Event('pointerdown'));
    player.skip();
    vi.advanceTimersByTime(20_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('Escape skips and is not seen by game key listeners', () => {
    const { onDone } = mount(true);
    const game = vi.fn();
    window.addEventListener('keydown', game);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(game).not.toHaveBeenCalled();
    window.removeEventListener('keydown', game);
  });

  it('long-press skips; a short tap does not', () => {
    const { onDone, player } = mount(true);
    player.el.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(200);
    player.el.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(600);
    expect(onDone).not.toHaveBeenCalled();
    player.el.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(700);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reduced motion shows the caption at once', () => {
    const { player } = mount(true);
    expect(player.el.querySelector('.cut__caption')?.textContent).toBe('첫 번째.');
  });

  it('Ken Burns never shifts past the zoom overscan', () => {
    expect(kenBurns({ zoom: 1, x: 0, y: 1 })).toBe('translate(0.00%, 0.00%) scale(1.000)');
    expect(kenBurns({ zoom: 1.2, x: 0, y: 0.5 })).toBe('translate(10.00%, 0.00%) scale(1.200)');
  });
});

describe('nickname card', () => {
  it('validates 2–12 Hangul / Latin / digits / _', () => {
    expect(nicknameError('K')).toMatch(/2자/);
    expect(nicknameError('ABCDEFGHIJKLM')).toMatch(/12자/);
    expect(nicknameError('요원 K')).toMatch(/한글/);
    expect(nicknameError('GHOST_07')).toBeNull();
    expect(nicknameError('섀도우런')).toBeNull();
  });

  it('shows client errors inline without calling the server, then a server error, then closes on success', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const ui = createUi(root, callbacks());
    const submit = vi.fn(async (name: string) => (name === 'TAKEN' ? '이미 사용 중인 호출명.' : null));
    ui.showNickname(null, submit);
    const input = root.querySelector<HTMLInputElement>('.nick__input')!;
    const send = root.querySelector<HTMLButtonElement>('.nick__submit')!;
    const msg = () => root.querySelector('.nick__msg')?.textContent;

    input.value = 'K';
    send.click();
    expect(msg()).toMatch(/2자/);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(submit).not.toHaveBeenCalled();

    input.value = 'TAKEN';
    send.click();
    expect(send.classList.contains('is-busy')).toBe(true);
    await vi.waitFor(() => expect(msg()).toBe('이미 사용 중인 호출명.'));
    expect(send.classList.contains('is-busy')).toBe(false);

    input.value = 'GHOST_07';
    send.click();
    await vi.waitFor(() => expect(root.querySelector('.nick')).toBeNull());
    expect(submit).toHaveBeenLastCalledWith('GHOST_07');
    root.remove();
  });
});

describe('boss bar', () => {
  const hud: HudState = {
    hearts: 3, maxHearts: 3, score: 0, combo: 0, progress: 0, feverGauge: 0, fever: false, shield: false, slowMo: false,
    title: '1-10 · t', coins: 0, sliding: false, section: 0, sections: 3, boss: null,
  };

  it('is hidden without a boss, shows codename/name/phase, and flashes when hp drops', () => {
    const root = document.createElement('div');
    const ui = createUi(root, callbacks());
    ui.showHud();
    ui.updateHud(hud);
    const bar = root.querySelector<HTMLElement>('.boss')!;
    expect(bar.hidden).toBe(true);

    ui.updateHud({ ...hud, boss: { name: '정문 경비대장', codename: 'SENTINEL-01', hp: 1, phase: 0 } });
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain('SENTINEL-01');
    expect(bar.textContent).toContain('PHASE 1/3');
    expect(bar.classList.contains('is-hit')).toBe(false);

    ui.updateHud({ ...hud, boss: { name: '정문 경비대장', codename: 'SENTINEL-01', hp: 0.5, phase: 1 } });
    expect(bar.classList.contains('is-hit')).toBe(true);
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    const fills = [...bar.querySelectorAll<HTMLElement>('.boss__fill')].map((f) => f.style.transform);
    expect(fills).toEqual(['scaleX(1)', 'scaleX(0.5)', 'scaleX(0)']);
  });
});

describe('result online status', () => {
  it('a second showResult for the same run only swaps the status line', () => {
    const root = document.createElement('div');
    const ui = createUi(root, callbacks());
    const info = {
      mode: 'endless', stageId: null, title: '무한 침투', cleared: false, stars: 0, score: 4200, best: 5000, newRecord: false,
      perfects: 10, goods: 2, misses: 1, maxCombo: 9, coinsEarned: 3, hasNext: false,
    } as const;
    ui.showResult({ ...info, online: { state: 'pending' } });
    const card = root.querySelector('.report');
    expect(root.querySelector('.report__online')?.textContent).toContain('검증 중');

    ui.showResult({ ...info, online: { state: 'ranked', rank: 37 } });
    expect(root.querySelector('.report')).toBe(card); // not rebuilt: no count-up / entry replay
    expect(root.querySelector('.report__online')?.textContent).toContain('랭킹 등록 #37');
    expect(root.querySelectorAll('.report__online').length).toBe(1);

    ui.showResult({ ...info, score: 9999, online: { state: 'offline' } }); // a different run rebuilds
    expect(root.querySelector('.report')).not.toBe(card);
    expect(root.querySelector('.report__online')?.textContent).toContain('오프라인');
  });
});

describe('leaderboard + banners', () => {
  it('renders loading, offline (retry) and pinned my-row states', () => {
    const root = document.createElement('div');
    const cb = callbacks();
    const ui = createUi(root, cb);
    ui.showLeaderboard('endless', 'loading');
    expect(root.textContent).toContain('순위 수신 중');
    ui.showLeaderboard('endless', 'offline');
    root.querySelector<HTMLButtonElement>('.lb__state--offline .btn')?.click();
    expect(cb.onOpenLeaderboard).toHaveBeenCalledWith('endless');
    ui.showLeaderboard('endless-week', { top: [{ rank: 1, nickname: 'A', score: 10, me: false }], mine: { rank: 88, nickname: 'ME', score: 1, me: true } });
    expect(root.querySelector('.lb__pin .lb__row.is-me')?.textContent).toContain('88');
  });

  it('achievement banners stack and leave after 3s', () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    const ui = createUi(root, callbacks());
    ui.toastAchievement({ id: 'first-clear', name: '첫 임무', desc: 'd' });
    ui.toastAchievement({ id: 'zone-1', name: '구역 1 돌파', desc: 'd' });
    expect(root.querySelectorAll('.ach-toast').length).toBe(2);
    vi.advanceTimersByTime(3400);
    expect(root.querySelectorAll('.ach-toast').length).toBe(0);
    vi.useRealTimers();
  });
});
