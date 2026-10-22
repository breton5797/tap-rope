/** Pointer + keyboard input. Every pointerdown on the canvas is one tap. */
export interface InputHandlers {
  onTap(): void;
  onPauseKey(): void;
}

const TAP_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'w', 'W', 'Enter']);
const PAUSE_KEYS = new Set(['Escape', 'p', 'P']);

export function bindInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    h.onTap();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') && e.key !== 'Escape') return;
    if (TAP_KEYS.has(e.key)) {
      e.preventDefault();
      h.onTap();
    } else if (PAUSE_KEYS.has(e.key)) {
      h.onPauseKey();
    }
  });
}
