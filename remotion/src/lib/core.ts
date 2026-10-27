import type React from 'react';
import { useMemo } from 'react';
import gsap from 'gsap';

// ---------- data from Pass 1 (scripts/track.py) ----------
export type Track = {
  fps: number; width: number; height: number; frames: number; duration: number;
  static: boolean; audio: boolean; matte: string; bg_luma?: number;
  face: number[][];   // per frame [x, y, w], x/w normalised by width, y by height
  top: number[];      // per frame: top of the head, normalised by height
};
export type FxSpec = { fx: string; start: number; end: number } & Record<string, unknown>;
/** The ChatRender intro: the command typed, its one-line description, the attachment's name, its length. */
export type IntroSpec = { command?: string; description?: string; base?: string; file?: string; seconds?: number; tag?: string; placeholder?: string };
export type Props = {
  track: Track; effects: FxSpec[]; cards: string[]; hasRoom: boolean;
  intro?: IntroSpec | null;                    // play ChatRender first, then cut to the clip
  clip?: { from?: number; to?: number } | null; // with an intro: the part of the clip that follows it (seconds)
  silent?: boolean;                            // no audio (the intro's frozen preview of the first frame)
};
export type Face = { x: number; y: number; w: number; top: number };

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** The smoothed face at a (possibly fractional) frame, in output pixels. */
export function faceAt(tr: Track, f: number): Face {
  const n = tr.face.length;
  if (!n) return { x: tr.width / 2, y: tr.height * 0.36, w: tr.width * 0.28, top: tr.height * 0.26 };
  const i = Math.max(0, Math.min(n - 1, Math.floor(f))), j = Math.min(n - 1, i + 1), k = clamp(f - i);
  const A = tr.face[i], B = tr.face[j];
  return {
    x: lerp(A[0], B[0], k) * tr.width,
    y: lerp(A[1], B[1], k) * tr.height,
    w: Math.max(lerp(A[2], B[2], k) * tr.width, tr.width * 0.05),
    top: lerp(tr.top[i] ?? A[1] - A[2], tr.top[j] ?? B[1] - B[2], k) * tr.height,
  };
}

// ---------- effects ----------
/** Everything an effect gets: its own clock (t, d), the frame size, the face and its options. Effects are pure functions of this. */
export type FxCtx = {
  t: number; d: number; fps: number; W: number; H: number;
  face: Face; o: FxSpec; cards: string[]; track: Track;
  bright: boolean;   // the room behind the head is light (pick dark ink)
};
export type Cam = { zoom: number; cx: number; cy: number; parallax?: number };
export type FxDef = {
  desc: string;
  options: string;
  camera?: (c: FxCtx) => Cam | null;          // moves the whole world (room, behind, you, front)
  room?: (c: FxCtx) => string;                // CSS filter on the room only
  person?: (c: FxCtx) => string;              // CSS filter on you only
  world?: (c: FxCtx) => string;               // CSS filter on room + you (a grade)
  Behind?: React.FC<{ c: FxCtx }>;           // between the room and you: you cover it
  Front?: React.FC<{ c: FxCtx }>;            // over you
  Screen?: React.FC<{ c: FxCtx }>;           // flat UI on top, ignores the camera
  blur?: number;                              // motion-blur samples for Behind / Front
  depth?: 'room' | 'behind' | 'screen';      // Behind at 'room' depth moves with the wall; at 'screen' it stays put while the camera moves (you still cover it)
  frontDepth?: 'screen';                     // Front stays put on screen while the camera moves (captions), still under Screen
  cameraBlur?: boolean;                       // blur the shot along the camera's motion (stronger when it moves faster)
  dof?: (c: FxCtx) => number;                 // depth of field: blur (px) on the room and the behind layer while you stay sharp
  freeze?: (c: FxCtx) => number | null;       // hold the footage (room and you) on this effect-local second
  sticker?: (c: FxCtx) => number;             // white outline around you, in px (0 = none), drawn behind you
  personScale?: (c: FxCtx) => number;         // scale you (and your outline) around your chest
  split?: (c: FxCtx) => { x: number; left: string; right: string } | null;   // two looks of the whole shot, split at x
  // the whole shot shrinks into a card (k 0..1): scaled by s, moved by dx/dy, clipped to x,y,w with top radius r; you break out of its top
  card?: (c: FxCtx) => { k: number; s: number; dx: number; dy: number; x: number; y: number; w: number; r: number } | null;
  Backdrop?: React.FC<{ c: FxCtx }>;         // screen-space set behind the shot (seen around a card)
};

/** Effect time in the frames of its reference timing: effects written against a set length are timed in its 30 fps frames,
 *  so a longer or shorter window stretches every move to match. */
export const specFrame = (c: FxCtx, refFrames: number) => (c.t / c.d) * refFrames;
/** Eased 0..1 between two reference frames. */
export const fr = (f: number, a: number, b: number, name = 'power2.inOut') => e(name, f, a, b - a);

export const opt = (c: FxCtx, k: string, d: number) => { const v = c.o[k]; return v === undefined || v === '' ? d : Number(v); };
export const str = (c: FxCtx, k: string, d: string) => { const v = c.o[k]; return v === undefined || v === null || v === '' ? d : String(v); };
export const list = (c: FxCtx, k: string, d: string[]) => { const v = c.o[k]; return v ? String(v).split('|').map((s) => s.trim()).filter(Boolean) : d; };

// ---------- GSAP, seek-safe ----------
// Remotion renders frames in any order, in several tabs at once. So no timeline ever plays on its own clock:
// it is built once, paused, and seeked to the effect's local time on every render. Tweens target a plain
// object, and the component reads the numbers back. Same frame in, same picture out.
gsap.defaults({ lazy: false, overwrite: false });
export { gsap };
const easeCache = new Map<string, (p: number) => number>();
export const ease = (name: string) => {
  let e = easeCache.get(name);
  if (!e) { e = gsap.parseEase(name) as (p: number) => number; easeCache.set(name, e); }
  return e;
};
/** e('expo.out', t, t0, dur) -> eased 0..1 progress of a move that starts at t0 and lasts dur. */
export const e = (name: string, t: number, t0: number, dur: number) => ease(name)(clamp((t - t0) / dur));

export function useTimeline<S extends Record<string, number>>(
  t: number, init: S, build: (tl: gsap.core.Timeline, s: S) => void, deps: unknown[] = [],
): S {
  const ref = useMemo(() => {
    const s = { ...init };
    const tl = gsap.timeline({ paused: true });
    build(tl, s);
    return { s, tl };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  ref.tl.seek(Math.max(0, t), true);
  return { ...ref.s };
}

// ---------- camera: one move, a different depth per layer ----------
/** CSS transform for a layer at zoom zl, keeping the face where the main camera (zoom z) puts it. Deeper layers get a smaller zoom: parallax. */
export function layerStyle(cam: Cam, zl: number, W: number, H: number, face: Face): React.CSSProperties {
  const z = Math.min(cam.zoom, 2.2);
  if (z <= 1.0005 && zl <= 1.0005) return {};
  const x0 = clamp(cam.cx - W / z / 2, 0, W - W / z), y0 = clamp(cam.cy - H / z / 2, 0, H - H / z);
  let X = x0, Y = y0, s = z;
  if (Math.abs(zl - z) > 1e-4) {
    s = Math.max(1, zl);
    const Sx = z * (face.x - x0), Sy = z * (face.y - y0);
    X = clamp(face.x - Sx / s, 0, W - W / s); Y = clamp(face.y - Sy / s, 0, H - H / s);
  }
  return { transform: `scale(${s}) translate(${-X}px, ${-Y}px)`, transformOrigin: '0 0' };
}

/** Where the main camera puts a face on screen (for layers that ignore the camera). */
export function screenFace(cam: Cam, f: Face, W: number, H: number): Face {
  const z = Math.min(cam.zoom, 2.2);
  if (z <= 1.0005) return f;
  const x0 = clamp(cam.cx - W / z / 2, 0, W - W / z), y0 = clamp(cam.cy - H / z / 2, 0, H - H / z);
  return { x: z * (f.x - x0), y: z * (f.y - y0), w: f.w * z, top: z * (f.top - y0) };
}

/** A mask that keeps a layer off your face (soft ellipse), in the layer's own pixel space. */
export function faceGuard(face: Face, amount = 1): React.CSSProperties {
  if (amount <= 0) return {};
  const rx = face.w * 0.7, ry = face.w * 0.95;
  const m = `radial-gradient(ellipse ${rx}px ${ry}px at ${face.x}px ${face.y - face.w * 0.08}px, rgba(0,0,0,${1 - amount}) 0%, rgba(0,0,0,${1 - amount}) 72%, #000 100%)`;
  return { WebkitMaskImage: m, maskImage: m };
}
