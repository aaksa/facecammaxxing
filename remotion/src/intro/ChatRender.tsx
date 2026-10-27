import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, e, lerp } from '../lib/core';
import { FONT } from '../lib/fonts';
import { ORANGE } from '../lib/layout';

// ChatRender: a ~2.5 s intro in a dark mobile chat. A clip is already attached in the message box; "/" is typed, a command
// card pops up, the rest of the command types out key by key on the keyboard; send; the clip flies up as the sent message
// with the command in an orange pill and "Editing with /command..." under a spinning star; a dark tile of tiny dots lights
// up and resolves into the first frame of what follows (`next`), grows to fill the screen, and the film cuts to it.
// Everything is a pure function of the frame, written in the frames of a 75-frame (2.5 s at 30 fps) reference, so any
// `seconds` stretches the whole intro to match. Layout is in 1080 x 1920 pixels, scaled to the composition.

export type ChatRenderProps = {
  command: string;              // "/glass-graph"
  description: string;          // "A glass card with a graph that climbs"
  next: React.ReactNode;        // the first frame of what follows, drawn at full composition size
  thumbnail: React.ReactNode;   // the attached clip, drawn at full composition size (cover-cropped into the thumb)
  file?: string;                // the attachment's name (talking.mp4)
  seconds?: number;             // 2.5
};

const REF = 75;
const BG = '#0c0c0e', PANEL = '#18181b', LINE = 'rgba(255,255,255,0.09)', DIM = '#8d8d96', INK = '#f2f2f4';
const KEY = '#2d2d32', KEY_FN = '#202024', KEY_LIT = '#7a7a84', KBD = '#121214';

/** A stable pseudo-random number in 0..1 for an index (no Math.random: frames render out of order). */
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** When each character of the command is typed (reference frames): "/" first, then the rest with an irregular hand. */
function typeTimes(n: number): number[] {
  if (n <= 0) return [];
  const t = [4];
  if (n === 1) return t;
  const gaps = Array.from({ length: n - 1 }, (_, i) => 0.55 + 0.9 * rnd(i + 7));
  const sum = gaps.reduce((a, b) => a + b, 0);
  let at = 10;
  for (let i = 1; i < n; i++) { t.push(at); at += (23 * gaps[i - 1]) / sum; }
  return t;
}

// ---------- layout (1080 x 1920) ----------
const W0 = 1080, H0 = 1920;
const KB_H = 620, KB_Y = H0 - KB_H;
const BOX = { x: 32, w: W0 - 64, h: 356, open: KB_Y - 16 - 356, rest: H0 - 44 - 196, restH: 196 };
const THUMB_IN = { x: BOX.x + 24, w: 124, h: 168 };                     // in the box (y follows the box)
const THUMB_OUT = { x: W0 - 48 - 300, y: 236, w: 300, h: 534 };          // the sent message
const TILE = { x: 48, y: 958, w: 378, h: 672 };
const CELL = 9;

type Rect = { x: number; y: number; w: number; h: number; r: number };
const mixRect = (a: Rect, b: Rect, k: number): Rect => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });

/** A full-size node (composition W x H) cover-fitted into a rect. */
const Fit: React.FC<{ r: Rect; W: number; H: number; children: React.ReactNode; style?: React.CSSProperties; inner?: React.CSSProperties }> =
  ({ r, W, H, children, style, inner }) => {
    const s = Math.max(r.w / W, r.h / H);
    return (
      <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.r, overflow: 'hidden', ...style }}>
        <div style={{ position: 'absolute', width: W, height: H, left: (r.w - W * s) / 2, top: (r.h - H * s) / 2, transform: `scale(${s})`, transformOrigin: '0 0', ...inner }}>
          {children}
        </div>
      </div>
    );
  };

// ---------- icons (drawn here, no icon font) ----------
const Svg: React.FC<{ x: number; y: number; s: number; children: React.ReactNode; vb?: number }> = ({ x, y, s, children, vb = 24 }) => (
  <svg width={s} height={s} viewBox={`0 0 ${vb} ${vb}`} style={{ position: 'absolute', left: x, top: y }} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const Star: React.FC<{ x: number; y: number; s: number; rot: number }> = ({ x, y, s, rot }) => (
  <svg width={s} height={s} viewBox="-12 -12 24 24" style={{ position: 'absolute', left: x, top: y, transform: `rotate(${rot}deg)` }}>
    <path d="M0 -11 C1.2 -3.5 3.5 -1.2 11 0 C3.5 1.2 1.2 3.5 0 11 C-1.2 3.5 -3.5 1.2 -11 0 C-3.5 -1.2 -1.2 -3.5 0 -11 Z" fill={ORANGE} />
  </svg>
);

// ---------- keyboard ----------
type Key = { id: string; label: string; x: number; y: number; w: number; h: number; fn: boolean };
const KEYS: Key[] = (() => {
  const rows: [string, number][][] = [
    '1234567890'.split('').map((k) => [k, 1]),
    'qwertyuiop'.split('').map((k) => [k, 1]),
    'asdfghjkl'.split('').map((k) => [k, 1]),
    [['shift', 1.5], ...'zxcvbnm'.split('').map((k): [string, number] => [k, 1]), ['back', 1.5]],
    [['123', 1.5], ['/', 1], ['space', 4.5], ['-', 1], ['return', 2]],
  ];
  const pad = 12, gap = 11, rowH = 104, keyH = 88, top = KB_Y + 22;
  const u = (W0 - 2 * pad - 9 * gap) / 10;
  const out: Key[] = [];
  rows.forEach((row, ri) => {
    const units = row.reduce((a, [, w]) => a + w, 0);
    const span = units * u + (row.length - 1) * gap;
    const avail = W0 - 2 * pad;
    const scale = units >= 10 ? (avail - (row.length - 1) * gap) / (units * u) : 1;
    let x = pad + (avail - (units >= 10 ? avail : span)) / 2;
    for (const [id, w] of row) {
      const kw = w * u * scale;
      out.push({ id, label: id, x, y: top + ri * rowH, w: kw, h: keyH, fn: id.length > 1 || id === '/' || id === '-' });
      x += kw + gap;
    }
  });
  return out;
})();
const keyFor = (ch: string) => (ch === ' ' ? 'space' : ch.toLowerCase());

const KeyCap: React.FC<{ k: Key; lit: number }> = ({ k, lit }) => {
  const icon = (d: React.ReactNode) => <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
  const label = k.id === 'shift' ? icon(<path d="M12 4 L20 13 H15.5 V20 H8.5 V13 H4 Z" />)
    : k.id === 'back' ? icon(<><path d="M9 5 H20 V19 H9 L3 12 Z" /><path d="M12 9.5 L16.5 14.5 M16.5 9.5 L12 14.5" /></>)
      : k.id === 'return' ? icon(<path d="M19 6 V12 H6 M10 8 L6 12 L10 16" />)
        : k.id === 'space' ? '' : k.label;
  const base = k.fn ? KEY_FN : KEY;
  return (
    <div style={{
      position: 'absolute', left: k.x, top: k.y + lit * 2, width: k.w, height: k.h, borderRadius: 14,
      background: lit > 0.01 ? `color-mix(in srgb, ${KEY_LIT} ${Math.round(lit * 100)}%, ${base})` : base,
      boxShadow: `0 2px 0 rgba(0,0,0,0.55)${lit > 0.01 ? `, 0 0 ${Math.round(22 * lit)}px rgba(255,255,255,${(0.16 * lit).toFixed(3)})` : ''}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK,
      fontFamily: FONT.ui, fontWeight: 500, fontSize: k.id.length > 1 ? 30 : 42,
    }}>{label}</div>
  );
};

// ---------- the dots tile: a grid that lights up and resolves into `next` ----------
function dotsPath(w: number, h: number, f: number, a: number, b: number): { clip: string | null; glints: [number, number, number][] } {
  const cols = Math.floor(w / CELL), rows = Math.floor(h / CELL), ox = (w - cols * CELL) / 2 + CELL / 2, oy = (h - rows * CELL) / 2 + CELL / 2;
  if (f >= b + 5) return { clip: null, glints: [] };
  let d = '';
  const glints: [number, number, number][] = [];
  const full = CELL * 0.75;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const n = j * cols + i;
      // a diagonal wave from the top left, broken up so it reads like pixels arriving
      const at = a + (b - a) * (0.55 * ((i / cols) * 0.4 + (j / rows) * 0.6) + 0.45 * rnd(n));
      if (f < at) continue;
      const k = e('expo.out', f, at, 4);
      const r = lerp(1.4, full, k), x = ox + i * CELL, y = oy + j * CELL;
      d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;
      if (f - at < 3) glints.push([x, y, 1 - (f - at) / 3]);
    }
  }
  return { clip: d ? `path('${d}')` : 'inset(100%)', glints };
}

export const ChatRender: React.FC<ChatRenderProps> = ({ command, description, next, thumbnail, file = 'talking.mp4', seconds = 2.5 }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const f = (frame / fps) * 30 * (2.5 / seconds);   // reference frame
  const cmd = command.startsWith('/') ? command : `/${command}`;
  const times = typeTimes(cmd.length);
  const typed = times.filter((t) => f >= t).length;

  // the beats, in reference frames
  const SEND = 37, MOVE = 39, TILE_IN = 50, LIGHT_A = 53, LIGHT_B = 63, GROW = 67;
  const sent = e('power2.in', f, SEND + 2, 10);                  // keyboard and box leave: ease in, accelerate away
  const fly = e('expo.out', f, MOVE, 13);                         // the clip lands as the sent message
  const press = f >= SEND && f < SEND + 3 ? 1 : 0;
  const grow = e('power3.inOut', f, GROW, REF - GROW);

  // keyboard: each key lights as it is pressed and fades over 4 frames
  const lit: Record<string, number> = {};
  times.forEach((t, i) => {
    const v = f >= t ? 1 - clamp((f - t) / 4) : 0;
    const id = keyFor(cmd[i]); if (v > (lit[id] ?? 0)) lit[id] = v;
  });

  // the message box: open above the keyboard, then (attachment sent) it settles at the bottom
  const boxY = lerp(BOX.open, BOX.rest, sent), boxH = lerp(BOX.h, BOX.restH, clamp((f - SEND) / 4));
  const textY = boxY + boxH - 72 - 22 - 64;
  const thumbIn: Rect = { x: THUMB_IN.x, y: BOX.open + 24, w: THUMB_IN.w, h: THUMB_IN.h, r: 18 };
  const thumb = mixRect(thumbIn, { ...THUMB_OUT, r: 30 }, fly);

  // the command card above the box
  const cardIn = e('expo.out', f, 4, 6), cardOut = e('power2.in', f, SEND, 4);
  const cardH = 150, cardY = BOX.open - 18 - cardH;

  // after the send: the pill, the status line, the tile
  const pill = e('expo.out', f, MOVE + 6, 8), status = e('expo.out', f, MOVE + 9, 8);
  const tileIn = e('expo.out', f, TILE_IN, 6);
  const tileRect = mixRect({ ...TILE, r: 28 }, { x: 0, y: 0, w: W0, h: H0, r: 0 }, grow);
  const dots = dotsPath(TILE.w, TILE.h, f, LIGHT_A, LIGHT_B);

  const caret = f < SEND && (Math.floor(f / 8) % 2 === 0 || (typed > 0 && f - times[typed - 1] < 6));
  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: W0, height: H0, transform: `scale(${W / W0}, ${H / H0})`, transformOrigin: '0 0', fontFamily: FONT.ui, color: INK }}>
        {/* status bar and header */}
        <div style={{ position: 'absolute', left: 64, top: 44, fontSize: 34, fontWeight: 600 }}>12:30</div>
        <svg width={120} height={34} viewBox="0 0 120 34" style={{ position: 'absolute', right: 56, top: 46 }}>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={i * 13} y={22 - i * 6} width={8} height={10 + i * 6} rx={2} fill={INK} />)}
          <rect x={66} y={6} width={46} height={24} rx={7} fill="none" stroke={INK} strokeWidth={2.5} opacity={0.6} />
          <rect x={70} y={10} width={30} height={16} rx={4} fill={INK} />
        </svg>
        <Svg x={48} y={128} s={64}><path d="M4 7 H20 M4 12 H20 M4 17 H14" /></Svg>
        <Svg x={W0 - 48 - 64} y={128} s={64}><path d="M12 4 H6 A2 2 0 0 0 4 6 V18 A2 2 0 0 0 6 20 H18 A2 2 0 0 0 20 18 V12" /><path d="M17.5 3.5 A2.1 2.1 0 0 1 20.5 6.5 L12 15 L8.5 16 L9.5 12.5 Z" /></Svg>

        {/* the sent message: pill + status line (the clip itself flies separately) */}
        <div style={{
          position: 'absolute', right: 48, top: THUMB_OUT.y + THUMB_OUT.h + 18, height: 62, padding: '0 28px', borderRadius: 31,
          background: ORANGE, color: '#fff', fontFamily: FONT.mono, fontWeight: 700, fontSize: 30, display: 'flex', alignItems: 'center',
          opacity: f >= MOVE + 6 ? clamp((f - MOVE - 6) / 2) : 0, transform: `translateY(${(1 - pill) * 24}px) scale(${lerp(1.12, 1, pill)})`, transformOrigin: '100% 50%',
        }}>{cmd}</div>
        <div style={{
          position: 'absolute', left: 48, top: TILE.y - 70, height: 44, display: 'flex', alignItems: 'center', gap: 16,
          opacity: f >= MOVE + 9 ? clamp((f - MOVE - 9) / 2) : 0, transform: `translateY(${(1 - status) * 18}px)`,
          color: DIM, fontSize: 32, fontWeight: 500,
        }}>
          <div style={{ position: 'relative', width: 34, height: 34 }}><Star x={0} y={0} s={34} rot={f * 9} /></div>
          Editing with {cmd}...
        </div>

        {/* the command card */}
        {f >= 4 && cardOut < 1 ? (
          <div style={{
            position: 'absolute', left: BOX.x + 8, width: BOX.w - 16, top: cardY, height: cardH, borderRadius: 26,
            background: '#202024', border: `1.5px solid ${LINE}`, boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
            padding: '0 34px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10,
            opacity: clamp((f - 4) / 2) * (1 - cardOut), transform: `translateY(${(1 - cardIn) * 16 + cardOut * 22}px) scale(${lerp(1.06, 1, cardIn)})`,
            transformOrigin: '50% 100%', filter: cardIn < 0.98 ? `blur(${(1 - cardIn) * 6}px)` : undefined,
          }}>
            <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 38, whiteSpace: 'pre' }}>
              <span style={{ color: INK }}>{cmd.slice(0, typed)}</span><span style={{ color: '#5d5d66' }}>{cmd.slice(typed)}</span>
            </div>
            <div style={{ color: DIM, fontSize: 30, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{description}</div>
          </div>
        ) : null}

        {/* the message box */}
        <div style={{ position: 'absolute', left: BOX.x, width: BOX.w, top: boxY, height: boxH, borderRadius: 40, background: PANEL, border: `1.5px solid ${LINE}` }} />
        <div style={{ position: 'absolute', left: BOX.x + 30, top: textY, height: 64, display: 'flex', alignItems: 'center', fontSize: 38 }}>
          {typed > 0 && f < SEND ? <span style={{ whiteSpace: 'pre' }}>{cmd.slice(0, typed)}</span> : <span style={{ color: '#6c6c75' }}>Reply...</span>}
          {caret ? <span style={{ display: 'inline-block', width: 3, height: 46, background: ORANGE, marginLeft: typed > 0 ? 4 : -2, order: typed > 0 ? 0 : -1 }} /> : null}
        </div>
        <div style={{ position: 'absolute', left: BOX.x + 22, top: boxY + boxH - 22 - 72, width: 72, height: 72, borderRadius: 36, border: `2px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={36} height={36} viewBox="0 0 24 24" stroke={INK} strokeWidth={2.2} strokeLinecap="round"><path d="M12 5 V19 M5 12 H19" /></svg>
        </div>
        <Svg x={BOX.x + BOX.w - 22 - 72 - 24 - 52} y={boxY + boxH - 22 - 72 + 10} s={52}><rect x={9} y={3} width={6} height={11} rx={3} /><path d="M5 11 A7 7 0 0 0 19 11 M12 18 V21" /></Svg>
        <div style={{
          position: 'absolute', left: BOX.x + BOX.w - 22 - 72, top: boxY + boxH - 22 - 72, width: 72, height: 72, borderRadius: 36, background: ORANGE,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${press ? 0.86 : 1})`,
        }}>
          <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 19 V5 M6 11 L12 5 L18 11" /></svg>
        </div>

        {/* the attached clip: in the box, then the sent message */}
        <Fit r={thumb} W={W} H={H} style={{ boxShadow: fly > 0 ? `0 18px 40px rgba(0,0,0,${0.5 * fly})` : undefined, border: `1.5px solid ${LINE}` }}>{thumbnail}</Fit>
        <div style={{ position: 'absolute', left: thumb.x + 8, top: thumb.y + thumb.h - 34, fontSize: 17, fontWeight: 600, color: '#fff', opacity: 1 - clamp(fly * 3), textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{file}</div>
        {fly < 0.3 ? (
          <div style={{ position: 'absolute', left: thumb.x + thumb.w - 30, top: thumb.y - 10, width: 40, height: 40, borderRadius: 20, background: '#2c2c31', border: `2px solid ${BG}`, opacity: 1 - clamp(fly * 4), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" stroke={INK} strokeWidth={3} strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
          </div>
        ) : null}

        {/* the keyboard */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W0, height: H0, transform: `translateY(${sent * (KB_H + 20)}px)` }}>
          <div style={{ position: 'absolute', left: 0, top: KB_Y, width: W0, height: KB_H, background: KBD, borderTop: `1px solid ${LINE}` }} />
          {KEYS.map((k) => <KeyCap key={k.id} k={k} lit={lit[k.id] ?? 0} />)}
          <div style={{ position: 'absolute', left: W0 / 2 - 70, top: H0 - 22, width: 140, height: 8, borderRadius: 4, background: '#55555c' }} />
        </div>

        {/* the tile: dots light up into the first frame of what follows, then it grows to fill the screen */}
        {f >= TILE_IN ? (
          <div style={{
            position: 'absolute', left: tileRect.x, top: tileRect.y, width: tileRect.w, height: tileRect.h, borderRadius: tileRect.r, overflow: 'hidden',
            background: '#141417', border: grow < 0.98 ? `1.5px solid ${LINE}` : undefined,
            opacity: clamp((f - TILE_IN) / 2), transform: grow > 0 ? undefined : `scale(${lerp(1.14, 1, tileIn)})`, transformOrigin: '0 0',
          }}>
            {grow <= 0 ? <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 1.5px, rgba(0,0,0,0) 2.2px)', backgroundSize: `${CELL}px ${CELL}px`, backgroundPosition: `${((TILE.w % CELL) / 2).toFixed(1)}px ${((TILE.h % CELL) / 2).toFixed(1)}px` }} /> : null}
            {f >= LIGHT_A ? (
              <div style={{ position: 'absolute', inset: 0, clipPath: grow > 0 ? undefined : (dots.clip ?? undefined) }}>
                <Fit r={{ x: 0, y: 0, w: tileRect.w, h: tileRect.h, r: 0 }} W={W} H={H}>{next}</Fit>
              </div>
            ) : null}
            {dots.glints.length && grow <= 0 ? (
              <svg width={TILE.w} height={TILE.h} style={{ position: 'absolute', inset: 0 }}>
                {dots.glints.map(([x, y, a], i) => <circle key={i} cx={x} cy={y} r={CELL * 0.42} fill={`rgba(255,255,255,${(0.55 * a).toFixed(2)})`} />)}
              </svg>
            ) : null}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
