// @vitest-environment jsdom
// v2.2 picker run preview: the selected card plays its hero's run cycle on a small canvas (the render
// worker's paintRunPreview); reduced motion paints the still run1 once; the loop ends with the picker.
import { describe, expect, it, vi } from 'vitest';
import { createRunPreview } from '../../src/office/ui/run-preview';

type Paint = (ctx: CanvasRenderingContext2D, skin: string, t: number) => boolean;

function rig(reduced: boolean, paint: Paint) {
  const queue: FrameRequestCallback[] = [];
  const raf = (cb: FrameRequestCallback): number => queue.push(cb);
  const fakeCtx = {} as CanvasRenderingContext2D;
  const p = createRunPreview({ reduced: () => reduced, paint, raf, context: () => fakeCtx });
  const tick = (ms: number): void => {
    const cbs = queue.splice(0);
    cbs.forEach((cb) => cb(ms));
  };
  return { p, queue, tick };
}

describe('picker run preview', () => {
  it('animates the shown hero while the canvas is on the page', () => {
    const paint = vi.fn<Paint>(() => true);
    const { p, queue, tick } = rig(false, paint);
    document.body.append(p.el);
    p.show('robot');
    tick(1000);
    tick(1250);
    expect(paint.mock.calls.map((c) => [c[1], c[2]])).toEqual([['robot', 0], ['robot', 0.25]]);
    p.show('cat');
    tick(1500);
    expect(paint.mock.calls.at(-1)?.[1]).toBe('cat');
    p.el.remove();
    tick(1600);
    expect(queue).toHaveLength(0); // the picker closed: the loop stopped
  });

  it('reduced motion paints the still run1 (t = 0) once it has loaded, then stops', () => {
    let loaded = false;
    const paint = vi.fn<Paint>(() => loaded);
    const { p, queue, tick } = rig(true, paint);
    document.body.append(p.el);
    p.show('kid');
    tick(500); // not loaded yet: try again next frame
    loaded = true;
    tick(900);
    expect(paint.mock.calls.map((c) => c[2])).toEqual([0, 0]);
    expect(queue).toHaveLength(0);
    p.el.remove();
  });

  it('is a labelled-off decorative canvas', () => {
    const { p } = rig(false, () => true);
    expect(p.el.tagName).toBe('CANVAS');
    expect(p.el.getAttribute('aria-hidden')).toBe('true');
    expect(p.el.classList.contains('picker__run')).toBe(true);
  });
});
