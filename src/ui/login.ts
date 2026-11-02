// Title login seam (office login spec §4): v8 has no login entry; the office build swaps in
// src/office/ui/login.ts (a 로그인 button and sheet, or the signed-in chip, and the legal page links).
import type { Ctx } from './dom';

export function loginEntry(_ctx: Ctx): HTMLElement | null {
  return null;
}

/** privacy policy / terms links on the settings screen (v8: none) */
export function legalLinks(): HTMLElement | null {
  return null;
}
