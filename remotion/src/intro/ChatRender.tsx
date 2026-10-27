import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, e, lerp } from '../lib/core';
import { FONT } from '../lib/fonts';
import { ORANGE } from '../lib/layout';

// ChatRender: a ~2.4 s chat intro, laid out and timed after the studied "36 effects" reel (references/instagram/De7JFJdo4KX.mp4).
// A warm dark chat. The clip is attached in the message box; "/" opens a command card, "e" is typed and the card is tapped to
// autocomplete "/effects", two letters of the effect are typed and tapped to complete it (the command turns orange once it is
// recognised). Each key pops a magnified balloon. Send: the keyboard drops, the clip and the orange command go up as the sent
// message, "Editing with <effect>..." spins, and a big 9:16 tile of orange dots fills into a mosaic that resolves into what
// follows. `next` plays inside the tile, which then grows to fill the screen; the film continues from there with no repeat.
// Drawn from scratch (no app logos or icon fonts). Pure function of the frame, written in the frames of a 72-frame (2.4 s at
// 30 fps) reference, so `seconds` stretches the whole intro. Layout in 1080 x 1920 pixels, scaled to the composition.

export type ChatRenderProps = {
  command: string;              // "/effects glass-graph" (or just "/glass-graph")
  description: string;          // the effect's line: "A glass card with a graph that climbs"
  base?: string;                // the base command's line on its card: "22 video effects for your clips"
  next: React.ReactNode;        // what follows, drawn at full composition size (Film plays it inside the tile from RESOLVE on)
  thumbnail: React.ReactNode;   // the attached clip, drawn at full composition size (cover-cropped into the thumb)
  file?: string;                // kept for plans that name the attachment; not drawn in this layout
  tag?: string;                 // the small label on the status line ("SPED UP"), '' for none
  seconds?: number;             // 2.4
  placeholder?: string;         // "Reply to Claude..."
};

export const REF = 72;
export const RESOLVE = 48;     // the tile has resolved into `next` here; Film starts the clip at this frame
/** Intro length and the frame where the clip starts playing inside the tile, in composition frames. */
export const chatTiming = (seconds: number, fps: number) => {
  const N = Math.round(seconds * fps);
  return { N, R: Math.round((N * RESOLVE) / REF) };
};

// ---------- palette (sampled from the reference) ----------
export const BG = '#262624', BOX = '#30302e', CARD = '#3e3d39', CARD_HI = '#4a4945', LINE = 'rgba(255,255,255,0.07)';
export const INK = '#f3f0ea', DIM = '#a6a39c', FAINT = '#7d7a74';
const KBD = '#2b2a28', BAR = '#1f1e1c', KEY = '#4a4946', KEY_FN = '#3a3936', KEY_POP = '#6b6a66';
export const TILE_BG = '#11100f';

/** A stable pseudo-random number in 0..1 for an index (no Math.random: frames render out of order). */
export const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- the typing script, in reference frames ----------
type Ev = { f: number; text: string; key?: string; auto?: 'base' | 'arg' };
function script(cmd: string): { evs: Ev[]; base: string; arg: string; send: number } {
  const sp = cmd.indexOf(' '), base = sp > 0 ? cmd.slice(0, sp) : cmd, arg = sp > 0 ? cmd.slice(sp + 1) : '';
  const evs: Ev[] = [{ f: 3, text: '/', key: '/' }];
  if (base.length > 1) evs.push({ f: 7, text: base.slice(0, 2), key: base[1] });
  evs.push({ f: 11, text: base + (arg ? ' ' : ''), auto: 'base' });            // tap the card: autocomplete
  if (arg) {
    evs.push({ f: 15, text: `${base} ${arg[0]}`, key: arg[0] });
    if (arg.length > 1) evs.push({ f: 18, text: `${base} ${arg.slice(0, 2)}`, key: arg[1] });
    evs.push({ f: 22, text: cmd, auto: 'arg' });
  }
  return { evs, base, arg, send: arg ? 27 : 17 };
}

// ---------- layout (1080 x 1920) ----------
const W0 = 1080, H0 = 1920;
const BOXO = { x: 32, y: 814, w: 1016, h: 402 };                // the message box above the keyboard
export const BOXS = { x: 37, y: 1767, w: 1011, h: 112 };               // after send: the one-line reply bar
const CARDR = { x: 32, y: 644, w: 1016, h: 150 };
const THUMB_IN = { x: 58, y: 838, w: 121, h: 168, r: 14 };
const THUMB_OUT = { x: 914, y: 199, w: 112, h: 173, r: 12 };
export const TILE = { x: 37, y: 551, w: 640, h: 1140, r: 22 };
const CELL = 14;
const KB_Y = 1253;

export type Rect = { x: number; y: number; w: number; h: number; r: number };
export const mix = (a: Rect, b: Rect, k: number): Rect => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });

/** A full-size node (composition W x H) cover-fitted into a rect. */
export const Fit: React.FC<{ r: Rect; W: number; H: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ r, W, H, children, style }) => {
  const s = Math.max(r.w / W, r.h / H);
  return (
    <div style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.r, overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', width: W, height: H, left: (r.w - W * s) / 2, top: (r.h - H * s) / 2, transform: `scale(${s})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  );
};

// ---------- icons (line drawings, drawn here) ----------
export const Ico: React.FC<{ x: number; y: number; s: number; c?: string; w?: number; children: React.ReactNode }> = ({ x, y, s, c = INK, w = 2, children }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" style={{ position: 'absolute', left: x - s / 2, top: y - s / 2 }} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
export const Plus = (p: { x: number; y: number; s: number; c?: string }) => <Ico {...p}><path d="M12 5 V19 M5 12 H19" /></Ico>;
const Sliders = (p: { x: number; y: number; s: number; c?: string }) => <Ico {...p}><path d="M4 8 H14 M18 8 H20 M4 16 H6 M10 16 H20" /><circle cx="16" cy="8" r="2" /><circle cx="8" cy="16" r="2" /></Ico>;
export const Mic = (p: { x: number; y: number; s: number; c?: string }) => <Ico {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11 A6.5 6.5 0 0 0 18.5 11 M12 17.5 V21" /></Ico>;
export const Up = (p: { x: number; y: number; s: number; c?: string; w?: number }) => <Ico {...p}><path d="M12 19 V5 M6 11 L12 5 L18 11" /></Ico>;
/** A soft eight-point spark (the "working" mark), rotating. */
export const Spark: React.FC<{ x: number; y: number; s: number; rot: number }> = ({ x, y, s, rot }) => (
  <svg width={s} height={s} viewBox="-12 -12 24 24" style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, transform: `rotate(${rot}deg)` }}>
    {[0, 45, 90, 135].map((a) => <rect key={a} x={-1.6} y={-11} width={3.2} height={22} rx={1.6} fill={ORANGE} transform={`rotate(${a})`} />)}
  </svg>
);

// ---------- keyboard (iOS-like, no number row) ----------
type Key = { id: string; x: number; y: number; w: number; h: number; fn: boolean };
const KEYS: Key[] = (() => {
  const out: Key[] = [], kw = 91, g = 15, kh = 112, rows = [1356, 1496, 1636, 1772];
  'qwertyuiop'.split('').forEach((k, i) => out.push({ id: k, x: 15 + i * (kw + g), y: rows[0], w: kw, h: kh, fn: false }));
  'asdfghjkl'.split('').forEach((k, i) => out.push({ id: k, x: 68 + i * (kw + g), y: rows[1], w: kw, h: kh, fn: false }));
  out.push({ id: 'shift', x: 15, y: rows[2], w: 135, h: kh, fn: true });
  'zxcvbnm'.split('').forEach((k, i) => out.push({ id: k, x: 174 + i * (kw + g), y: rows[2], w: kw, h: kh, fn: false }));
  out.push({ id: 'back', x: 930, y: rows[2], w: 135, h: kh, fn: true });
  out.push({ id: '123', x: 93, y: rows[3], w: 199, h: kh, fn: true });
  out.push({ id: 'space', x: 305, y: rows[3], w: 468, h: kh, fn: false });
  out.push({ id: '/', x: 786, y: rows[3], w: 199, h: kh, fn: false });
  return out;
})();
const keyId = (ch: string) => (ch === ' ' ? 'space' : ch.toLowerCase());

const KeyCap: React.FC<{ k: Key }> = ({ k }) => {
  const glyph = k.id === 'shift' ? <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.8} strokeLinejoin="round"><path d="M12 4 L20 13 H15.5 V20 H8.5 V13 H4 Z" /></svg>
    : k.id === 'back' ? <svg width={46} height={46} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5 H20 V19 H9 L3 12 Z" /><path d="M12 9.5 L16.5 14.5 M16.5 9.5 L12 14.5" /></svg>
      : k.id;
  return (
    <div style={{
      position: 'absolute', left: k.x, top: k.y, width: k.w, height: k.h, borderRadius: 16, background: k.fn ? KEY_FN : KEY,
      boxShadow: '0 2px 0 rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK,
      fontFamily: FONT.ui, fontWeight: 400, fontSize: k.id.length > 1 ? 34 : 50,
    }}>{glyph}</div>
  );
};
/** The magnified balloon a pressed letter key shows for a few frames. */
const Balloon: React.FC<{ k: Key; a: number }> = ({ k, a }) => {
  const w = k.w * 1.32, h = k.h * 1.9;
  return (
    <div style={{
      position: 'absolute', left: k.x + k.w / 2 - w / 2, top: k.y + k.h - h, width: w, height: h, borderRadius: 20, background: KEY_POP,
      boxShadow: '0 10px 26px rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'center', paddingTop: 18, boxSizing: 'border-box',
      fontFamily: FONT.ui, fontSize: 78, color: INK, opacity: a, transform: `scale(${lerp(0.9, 1, a)})`, transformOrigin: '50% 100%',
    }}>{k.id}</div>
  );
};

// ---------- the dots tile ----------
/** Clip path of image dots: a diagonal wave of dots that grow from specks into a mosaic, then the picture snaps in. */
export function mosaic(w: number, h: number, f: number, a: number, b: number): string | null {
  if (f >= b) return null;
  const cols = Math.floor(w / CELL), rows = Math.floor(h / CELL), ox = (w - cols * CELL) / 2 + CELL / 2, oy = (h - rows * CELL) / 2 + CELL / 2;
  let d = '';
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const n = j * cols + i, at = a + (b - a - 3) * (0.5 * ((i / cols) * 0.35 + (j / rows) * 0.65) + 0.5 * rnd(n));
    if (f < at) continue;
    const r = lerp(1.2, CELL * 0.62, e('expo.out', f, at, 4)), x = ox + i * CELL, y = oy + j * CELL;
    d += `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;
  }
  return d ? `path('${d}')` : 'inset(100%)';
}
/** The orange specks that twinkle on the dark tile before the picture arrives. */
export const Specks: React.FC<{ f: number; w: number; h: number; fade: number; from?: number }> = ({ f, w, h, fade, from = 36 }) => {
  const dots: React.ReactNode[] = [];
  for (let n = 0; n < 320; n++) {
    const born = from + 8 * rnd(n * 3 + 1);
    if (f < born) continue;
    const tw = 0.45 + 0.55 * Math.abs(Math.sin(f * 0.7 + n));
    dots.push(<circle key={n} cx={rnd(n * 7 + 2) * w} cy={rnd(n * 11 + 5) * h} r={1.6 + 2.2 * rnd(n * 13)} fill={rnd(n * 17) > 0.25 ? ORANGE : '#f2e6dc'} opacity={tw * (1 - fade)} />);
  }
  return <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>{dots}</svg>;
};

/** The chat header: a menu button, a two-tab toggle (the second tab selected) and a compose button. */
export const ChatHeader: React.FC = () => (
  <>
  <div style={{ position: 'absolute', left: 54, top: 91, width: 68, height: 68, borderRadius: 34, background: '#2f2f2c' }} />
  <Ico x={88} y={125} s={38}><path d="M5 9 H19 M5 15 H15" /></Ico>
  <div style={{ position: 'absolute', left: 374, top: 87, width: 332, height: 76, borderRadius: 38, background: '#333230' }} />
  <div style={{ position: 'absolute', left: 536, top: 93, width: 164, height: 64, borderRadius: 32, background: '#4a4946' }} />
  <div style={{ position: 'absolute', left: 374, width: 166, top: 87, height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 500, color: DIM }}>Chat</div>
  <div style={{ position: 'absolute', left: 536, width: 164, top: 87, height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 600 }}>Code</div>
  <div style={{ position: 'absolute', left: 955, top: 91, width: 68, height: 68, borderRadius: 34, background: '#2f2f2c' }} />
  <Ico x={989} y={125} s={36}><path d="M12 4 H6 A2 2 0 0 0 4 6 V18 A2 2 0 0 0 6 20 H18 A2 2 0 0 0 20 18 V12" /><path d="M17.5 3.5 A2.1 2.1 0 0 1 20.5 6.5 L12 15 L8.5 16 L9.5 12.5 Z" /></Ico>

  </>
);

export const ChatRender: React.FC<ChatRenderProps> = ({
  command, description, base: baseLine = 'video effects for your clips', next, thumbnail, tag = 'SPED UP', seconds = 2.4, placeholder = 'Reply to Claude...',
}) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const f = (frame / fps) * 30 * (2.4 / seconds);   // reference frame
  const cmd = command.startsWith('/') ? command : `/${command}`;
  const { evs, base, arg, send } = script(cmd);
  const cur = [...evs].reverse().find((v) => f >= v.f);
  const text = cur?.text ?? '';
  const baseDone = evs.some((v) => v.auto === 'base' && f >= v.f);
  const name = arg || base.slice(1);

  // the beats
  const MOVE = send + 2, STATUS = send + 7, TILE_IN = send + 9, DOTS_A = TILE_IN + 2, GROW = 64;
  const drop = e('power2.in', f, send + 1, 8);                     // keyboard leaves: ease in, accelerate away
  const fly = e('expo.out', f, MOVE, 9);                           // the clip lands as the sent message
  const press = f >= send && f < send + 2;
  const grow = e('power3.inOut', f, GROW, REF - GROW);

  // card: base command first, the effect once its letters are typed; a tap (autocomplete) flashes it
  const phaseB = arg && f >= 15;
  const cardOn = f >= 3 && f < send && !(f >= 12 && f < 15);
  const cardStart = phaseB ? 15 : 3, cardK = e('expo.out', f, cardStart, 5);
  const tapAt = phaseB ? 22 : 11, tap = f >= tapAt - 1 && f < tapAt + 1;

  // the box: open above the keyboard, then the reply bar at the bottom
  const box = mix({ ...BOXO, r: 30 }, { ...BOXS, r: 56 }, e('expo.out', f, send + 1, 8));
  const boxOpen = f < send + 1;
  const thumb = mix(THUMB_IN, THUMB_OUT, fly);

  // keyboard: the last key pressed pops a balloon for 3 frames; the predictive bar quotes the word being typed
  const pressed = evs.filter((v) => v.key && f >= v.f && f < v.f + 3).pop();
  const word = text.split(' ').pop()!.replace(/^\//, '');
  const showWord = cur?.key && word && cur.key !== '/';

  const caret = f < send && Math.floor(f / 8) % 2 === 0;
  const tileRect = mix(TILE, { x: 0, y: 0, w: W0, h: H0, r: 0 }, grow);
  const resolved = f >= RESOLVE;
  const clip = grow > 0 ? null : mosaic(TILE.w, TILE.h, f, DOTS_A + 3, RESOLVE);

  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: W0, height: H0, transform: `scale(${W / W0}, ${H / H0})`, transformOrigin: '0 0', fontFamily: FONT.ui, color: INK }}>
        <ChatHeader />

        {/* the sent message: the command in orange, then the status line */}
        {f >= MOVE + 3 ? (
          <div style={{
            position: 'absolute', right: 40, top: 398, height: 68, padding: '0 22px', borderRadius: 20, background: 'rgba(255,255,255,0.035)',
            display: 'flex', alignItems: 'center', fontSize: 42, color: ORANGE, whiteSpace: 'nowrap',
            transform: `translateY(${(1 - e('expo.out', f, MOVE + 3, 6)) * 30}px)`, opacity: clamp((f - MOVE - 3) / 2),
          }}>{cmd}</div>
        ) : null}
        {f >= STATUS ? (
          <div style={{ position: 'absolute', left: 56, right: 54, top: 486, height: 50, opacity: clamp((f - STATUS) / 2), transform: `translateY(${(1 - e('expo.out', f, STATUS, 6)) * 18}px)` }}>
            <Spark x={20} y={25} s={38} rot={f * 8} />
            <div style={{ position: 'absolute', left: 60, top: 0, height: 50, display: 'flex', alignItems: 'center', fontSize: 37, color: '#ddd9d2', whiteSpace: 'nowrap' }}>Editing with {name}...</div>
            {tag ? <div style={{ position: 'absolute', right: 0, top: 0, height: 50, display: 'flex', alignItems: 'center', fontFamily: FONT.mono, fontSize: 20, letterSpacing: 4, color: FAINT }}>{tag}</div> : null}
          </div>
        ) : null}

        {/* the command card above the box */}
        {cardOn ? (
          <div style={{
            position: 'absolute', left: CARDR.x, top: CARDR.y, width: CARDR.w, height: CARDR.h, borderRadius: 22, boxSizing: 'border-box', padding: '0 34px',
            background: tap ? CARD_HI : CARD, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
            transform: `translateY(${(1 - cardK) * 22}px)`, opacity: clamp((f - cardStart) / 2),
          }}>
            <div style={{ fontSize: 42, fontWeight: 700, whiteSpace: 'nowrap' }}>{phaseB ? arg : base}</div>
            <div style={{ fontSize: 29, color: DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{phaseB ? description : baseLine}</div>
          </div>
        ) : null}

        {/* the message box (then the reply bar) */}
        <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.r, background: BOX, border: `1.5px solid ${LINE}` }} />
        {boxOpen ? (
          <>
            <div style={{ position: 'absolute', left: 60, top: 1024, height: 64, display: 'flex', alignItems: 'center', fontSize: 46, whiteSpace: 'pre' }}>
              {text ? (baseDone
                ? <><span style={{ color: ORANGE }}>{base}</span><span>{text.slice(base.length)}</span></>
                : <span>{text}</span>) : null}
              {caret ? <span style={{ display: 'inline-block', width: 3, height: 50, background: INK, marginLeft: 2 }} /> : null}
              {!text ? <span style={{ color: FAINT }}>{placeholder}</span> : null}
            </div>
            <Plus x={80} y={1151} s={40} c={DIM} />
            <Sliders x={155} y={1151} s={40} c={DIM} />
            <Mic x={886} y={1151} s={40} c={DIM} />
            <div style={{ position: 'absolute', left: 935, top: 1108, width: 86, height: 86, borderRadius: 20, background: ORANGE, transform: `scale(${press ? 0.88 : 1})` }} />
            <Up x={978} y={1151} s={44} c="#fff" />
          </>
        ) : (
          <div style={{ opacity: clamp((f - send - 4) / 3) }}>
            <Plus x={92} y={1823} s={38} c={DIM} />
            <div style={{ position: 'absolute', left: 132, top: 1795, height: 56, display: 'flex', alignItems: 'center', fontSize: 40, color: FAINT }}>{placeholder}</div>
            <Mic x={918} y={1823} s={38} c={DIM} />
            <div style={{ position: 'absolute', left: 961, top: 1786, width: 74, height: 74, borderRadius: 37, background: '#3c3b38' }} />
            <Up x={998} y={1823} s={38} c="#8d8b86" />
          </div>
        )}

        {/* the attached clip: in the box with an x badge, then the sent message */}
        <Fit r={thumb} W={W} H={H} style={{ boxShadow: fly > 0 ? `0 14px 34px rgba(0,0,0,${0.45 * fly})` : undefined }}>{thumbnail}</Fit>
        {fly < 0.25 ? (
          <div style={{ position: 'absolute', left: thumb.x + thumb.w - 26, top: thumb.y - 8, width: 34, height: 34, borderRadius: 17, background: '#f3f0ea', opacity: 1 - clamp(fly * 5), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" stroke="#262624" strokeWidth={3.4} strokeLinecap="round"><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
          </div>
        ) : null}

        {/* the keyboard */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: W0, height: H0, transform: `translateY(${drop * (H0 - KB_Y + 30)}px)` }}>
          <div style={{ position: 'absolute', left: 0, top: KB_Y, width: W0, height: H0 - KB_Y, background: KBD }} />
          <div style={{ position: 'absolute', left: 0, top: KB_Y, width: W0, height: 92, background: BAR }} />
          {showWord ? <div style={{ position: 'absolute', left: 150, top: KB_Y, height: 92, display: 'flex', alignItems: 'center', fontSize: 34, color: INK }}>&ldquo;{word}&rdquo;</div> : null}
          {KEYS.map((k) => <KeyCap key={k.id} k={k} />)}
          {pressed ? (() => { const k = KEYS.find((q) => q.id === keyId(pressed.key!) && /^[a-z]$/.test(q.id)); return k ? <Balloon k={k} a={1 - clamp((f - pressed.f - 2) / 1)} /> : null; })() : null}
        </div>

        {/* the tile: orange specks, then a mosaic of the picture, then the picture; it plays, then grows to fill the screen */}
        {f >= TILE_IN ? (
          <div style={{
            position: 'absolute', left: tileRect.x, top: tileRect.y, width: tileRect.w, height: tileRect.h, borderRadius: tileRect.r, overflow: 'hidden',
            background: TILE_BG, opacity: clamp((f - TILE_IN) / 2), transform: grow > 0 ? undefined : `scale(${lerp(1.06, 1, e('expo.out', f, TILE_IN, 5))})`, transformOrigin: '0 0',
          }}>
            {!resolved ? <Specks f={f} w={TILE.w} h={TILE.h} fade={clamp((f - (RESOLVE - 4)) / 4)} from={TILE_IN} /> : null}
            {f >= DOTS_A + 3 ? (
              <div style={{ position: 'absolute', inset: 0, clipPath: clip ?? undefined }}>
                <Fit r={{ x: 0, y: 0, w: tileRect.w, h: tileRect.h, r: 0 }} W={W} H={H}>{next}</Fit>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
