// Office v2.2 hero picker: an animated run cycle on the selected card (a small DOM canvas the picker owns).
// Uses the same sprite frames as the stage; draws nothing until the frame has loaded (the card shows its art).
import { officeImage } from './images';
import { MAX_DRAW_SCALE, heroDrawScale, heroSkin } from './hero-style';

const RUN_FPS = 10;
const NAMES = Array.from({ length: 8 }, (_, i) => `run${i + 1}`);

/** the run frame at `t` seconds (8-frame cycle, or 4 when the extra frames are missing) */
export function previewFrame(t: number, frames: 4 | 8): string {
  return NAMES[Math.floor(t * RUN_FPS + 1e-6) % frames];
}

/** drawn hero height in a preview canvas `h` tall: the tallest hero fills it, the others keep the ratio */
export function previewHeight(h: number, skin: string): number {
  return (h * heroDrawScale(skin)) / MAX_DRAW_SCALE;
}

/** paint the run frame for `t` into the whole canvas (feet bottom-centre); false = not loaded yet */
export function paintRunPreview(ctx: CanvasRenderingContext2D, skin: string, t: number): boolean {
  const s = heroSkin(skin);
  const frames = officeImage(`hero-${s}-run8`) && officeImage(`hero-${s}-run5`) ? 8 : 4;
  const img = officeImage(`hero-${s}-${previewFrame(t, frames)}`);
  if (!img) return false;
  const { width: w, height: h } = ctx.canvas;
  const dh = previewHeight(h, s);
  const dw = (dh * img.naturalWidth) / img.naturalHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, (w - dw) / 2, h - dh, dw, dh);
  return true;
}
