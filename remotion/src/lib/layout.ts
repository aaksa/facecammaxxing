import type React from 'react';
import { clamp, e, FxCtx, lerp } from './core';
import { FONT } from './fonts';

// ---------- layout: the platform zones (1080 x 1920, scaled) ----------
export const zones = (c: FxCtx) => {
  const sx = c.W / 1080, sy = c.H / 1920;
  return { top: 250 * sy, bottom: 1536 * sy, railX: 940 * sx, railY0: 864 * sy, margin: 60 * sx };
};
/** The right edge allowed for a box spanning y0..y1 (the right rail only exists between 864 and 1536). */
export const rightEdge = (c: FxCtx, y0: number, y1: number) => { const z = zones(c); return y1 > z.railY0 && y0 < z.bottom ? z.railX : c.W - z.margin; };
export const chin = (c: FxCtx) => c.face.y + c.face.w * 0.62;
/** The band under the chin and above the caption zone, where chest-height panels live. */
export const band = (c: FxCtx) => { const top = chin(c) + px(c, 22); return { top, h: zones(c).bottom - px(c, 14) - top }; };
export const px = (c: FxCtx, v: number) => (v * c.W) / 1080;          // sizes are written for 1080 wide
export const ORANGE = '#D97757';                                       // the one accent colour: the win

/** Smoked glass, the one material every card in the set shares. */
export const smoked = (c: FxCtx, r = 30): React.CSSProperties => ({
  borderRadius: px(c, r), background: 'rgba(18,16,16,0.5)', border: '1.5px solid rgba(255,255,255,0.2)',
  backdropFilter: 'blur(24px) saturate(150%)', WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  boxShadow: '0 28px 64px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.12)', color: '#fff', fontFamily: FONT.ui,
});

/** Arrive from oversize: ~6 frames from scale 1.45 and -6 deg (dir mirrors the angle), no overshoot. */
export const arrive = (f: number, at: number, dir = 1, dur = 6) => {
  const k = e('expo.out', f, at, dur);
  return { k, on: f >= at, transform: `scale(${lerp(1.45, 1, k)}) rotate(${lerp(-6 * dir, 0, k)}deg)`, opacity: clamp((f - at) / 2) };
};

