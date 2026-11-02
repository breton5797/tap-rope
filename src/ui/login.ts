// Title login seam (office login spec §4): v8 has no login entry; the office build swaps in
// src/office/ui/login.ts (a 로그인 button and sheet, or the signed-in chip).
import type { Ctx } from './dom';

export function loginEntry(_ctx: Ctx): HTMLElement | null {
  return null;
}
