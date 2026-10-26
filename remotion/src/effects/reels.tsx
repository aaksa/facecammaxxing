import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { clamp, e, fr, FxCtx, FxDef, lerp, list, opt, specFrame, str } from '../lib/core';
import { FONT } from '../lib/fonts';
import { cardSrc, useFitSize } from '../lib/assets';
import { band, chin, px, rightEdge, zones } from '../lib/layout';

// Effects studied from the first scene of two reference reels:
//   reel 1 (editorial talking head): kinetic captions in two type faces, the top words tucked behind the head, a conveyor of
//     retro window cards under the chin that a cursor clicks, hard punch-ins (lean-in) and exits that drop with motion blur.
//   reel 3 (podcast): a flat silhouette for the first frames, a lower-third name tag sliding in from the left edge,
//     small lead-in words over one big accent word, a dark fade at the bottom.
// Same rules as the rest of the library: entries focus in from blur in ~6 frames, exits ease in and leave by moving, nothing
// over the face, nothing in the platform zones.

// ---------- shared: exits and a vertical motion blur ----------
/** Vertical-only blur filters (SVG), referenced as url(#fcm-vb-N): a CSS blur() can only blur in every direction. */
const VB_LEVELS = 8;
const VBlurDefs: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    {Array.from({ length: VB_LEVELS }, (_, i) => (
      <filter key={i} id={`fcm-vb-${i + 1}`} x="-10%" y="-60%" width="120%" height="220%">
        <feGaussianBlur stdDeviation={`0 ${(i + 1) * 3}`} />
      </filter>
    ))}
  </svg>
);
const vblur = (k: number) => { const n = Math.round(clamp(k) * VB_LEVELS); return n > 0 ? `url(#fcm-vb-${n})` : ''; };

export type ExitKind = 'drop' | 'blow' | 'sink' | 'focus';
/** How a block leaves, from k = eased-in exit progress (0 = still there, 1 = gone).
 *  drop: falls out of frame, smeared along its fall. blow: grows past the camera and goes soft (the reel's words behind a
 *  punch-in). sink: slides down behind the body by `hidden` px. focus: goes out of focus where it is. */
export function exitStyle(kind: string, k: number, c: FxCtx, hidden = 0): React.CSSProperties {
  if (k <= 0) return {};
  switch (kind as ExitKind) {
    case 'blow': return { transform: `scale(${1 + 0.35 * k})`, filter: `blur(${k * px(c, 18)}px)`, opacity: 1 - clamp((k - 0.3) / 0.7) };
    case 'sink': return { transform: `translateY(${k * hidden}px)`, filter: `blur(${k * px(c, 6)}px)` };
    case 'focus': return { filter: `blur(${k * px(c, 16)}px)`, opacity: 1 - clamp((k - 0.4) / 0.6) };
    default: return { transform: `translateY(${k * c.H * 0.45}px)`, filter: vblur(k) || undefined, opacity: 1 - clamp((k - 0.85) / 0.15) };
  }
}

// ---------- kinetic caption ----------
// Words come in one at a time, each focusing up from a blur. A line is big (condensed caps / heavy sans) unless its words
// are wrapped in _underscores_, which makes them the small voice (a script in editorial, small white in podcast).
// Lines are split with " / ". At the top of the frame the caption sits behind you, so your head covers it.
type Word = { w: string; small: boolean };
const parseLines = (text: string): Word[][] => text.split('/').map((l) => l.trim()).filter(Boolean).map((line) => {
  let small = false;
  return line.split(/\s+/).map((tok) => {
    let w = tok, s = small;
    if (w.startsWith('_')) { w = w.slice(1); s = small = true; }
    if (w.endsWith('_')) { w = w.slice(0, -1); small = false; }
    return { w, small: s };
  }).filter((x) => x.w);
});

type CapStyle = { big: string; bigW: string; small: string; smallW: string; smallK: number; upper: boolean; color: string; smallColor: string; size: number; track: number; shadow: string };
const CAP_STYLES: Record<string, CapStyle> = {
  // reel 1: heavy condensed yellow caps + a calligraphic script in the same yellow
  editorial: { big: FONT.anton, bigW: '400', small: FONT.script, smallW: '400', smallK: 0.5, upper: true, color: '#FFD23F', smallColor: '', size: 170, track: 0, shadow: '0 10px 34px rgba(0,0,0,0.3)' },
  // reel 3: small white lead-in words over a big, tightly tracked accent word
  podcast: { big: FONT.ui, bigW: '800', small: FONT.ui, smallW: '600', smallK: 0.3, upper: false, color: '#DDF08A', smallColor: '#ffffff', size: 132, track: -0.045, shadow: '0 4px 20px rgba(0,0,0,0.38)' },
};
const capStyle = (c: FxCtx) => CAP_STYLES[str(c, 'style', 'editorial')] ?? CAP_STYLES.editorial;
const capLayer = (c: FxCtx) => str(c, 'layer', str(c, 'y', 'top') === 'top' ? 'behind' : 'front');

const Caption: React.FC<{ c: FxCtx; side: 'behind' | 'front' }> = ({ c, side }) => {
  const st = capStyle(c), { W, H, face } = c, z = zones(c);
  const lines = parseLines(str(c, 'text', '_If you want your_ / CONTENT'));
  const words = lines.flat();
  const maxW = W * opt(c, 'width', 0.86);
  const fits = lines.map((l) => {
    const allSmall = l.every((w) => w.small);
    const t = l.map((w) => (st.upper && !w.small ? w.w.toUpperCase() : w.w)).join(' ');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return { allSmall, fit: useFitSize(t, allSmall ? st.small : st.big, maxW, allSmall ? st.smallW : st.bigW, allSmall ? 0 : st.track) };
  });
  if (capLayer(c) !== side || fits.some((f) => !f.fit)) return null;

  const big = px(c, opt(c, 'size', st.size));
  const sizes = fits.map((f) => Math.min(f.allSmall ? big * st.smallK : big, f.fit!));
  const lineH = sizes.map((s, i) => s * (fits[i].allSmall ? 1.15 : 0.98));
  const blockH = lineH.reduce((a, b) => a + b, 0);
  const blockW = Math.max(...sizes.map((s, i) => (maxW * s) / fits[i].fit!));
  const y = str(c, 'y', 'top');
  let top = y === 'chest' ? chin(c) + px(c, 30)
    : y === 'low' ? z.bottom - px(c, 30) - blockH
    : y === 'top' ? face.top + face.w * 0.22 + lineH[lineH.length - 1] / 2 - blockH   // the last line straddles the top of your head
    : Number(y) * H - blockH / 2;
  top = clamp(top, z.top, z.bottom - blockH);
  const right = rightEdge(c, top, top + blockH);
  const cx = clamp(face.x, z.margin + blockW / 2, Math.max(z.margin + blockW / 2, right - blockW / 2));

  // word clocks: absolute clip seconds from `times` (e.g. from words.json), else one word every `rate` frames
  const times = list(c, 'times', []).map(Number);
  const rate = opt(c, 'rate', 4) / 30;
  const at = words.map((_, i) => (Number.isFinite(times[i]) ? times[i] - c.o.start : i * rate));
  const outDur = opt(c, 'exit_dur', 0.27);
  const out = e('power2.in', c.t, c.d - outDur, outDur);
  const exit = str(c, 'exit', side === 'behind' ? 'blow' : 'drop');
  const lift = e('sine.inOut', c.t, 0, c.d) * px(c, 14);              // the hold keeps drifting up a touch
  const col = str(c, 'color', st.color), small = st.smallColor || col;
  let n = 0;
  return (
    <AbsoluteFill>
      <VBlurDefs />
      <div style={{
        position: 'absolute', left: cx - W / 2, width: W, top: top - lift, display: 'flex', flexDirection: 'column', alignItems: 'center',
        transformOrigin: `50% ${blockH / 2}px`, ...exitStyle(exit, out, c, chin(c) + px(c, 120) - top),
      }}>
        {lines.map((l, li) => (
          <div key={li} style={{ height: lineH[li], display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: sizes[li] * 0.22, whiteSpace: 'nowrap', lineHeight: 1 }}>
            {l.map((w) => {
              const i = n++, k = e('expo.out', c.t, at[i], 0.2);
              const s = w.small && !fits[li].allSmall ? sizes[li] * st.smallK : sizes[li];
              // a word not said yet still holds its place, so the line never re-centres when it lands
              if (c.t < at[i]) return <span key={i} style={{ fontFamily: w.small ? st.small : st.big, fontWeight: Number(w.small ? st.smallW : st.bigW), fontSize: s, letterSpacing: w.small ? 0 : `${st.track}em`, visibility: 'hidden' }}>{st.upper && !w.small ? w.w.toUpperCase() : w.w}</span>;
              return (
                <span key={i} style={{
                  display: 'inline-block', fontFamily: w.small ? st.small : st.big, fontWeight: Number(w.small ? st.smallW : st.bigW), fontSize: s,
                  letterSpacing: w.small ? 0 : `${st.track}em`, color: w.small ? small : col, textShadow: st.shadow,
                  transform: `translateY(${(1 - k) * s * 0.4}px)`, filter: k < 0.999 ? `blur(${(1 - k) * s * 0.14}px)` : undefined,
                  opacity: clamp((c.t - at[i]) * 15),
                }}>{st.upper && !w.small ? w.w.toUpperCase() : w.w}</span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const KINETIC_CAPTION: FxDef = {
  desc: 'Captions word by word in two type faces, each word focusing up from a blur; at the top they sit behind your head, lower down in front; they leave by dropping out with motion blur (front) or blowing past the camera (behind)',
  options: 'text (lines split by /, _small words_), style (editorial | podcast), y (top | chest | low | 0..1), layer (behind | front), times (clip seconds per word, comma list), rate (4 frames per word), size (170 px), width (0.86), color, exit (drop | blow | sink | focus), exit_dur (0.27)',
  Behind: ({ c }) => <Caption c={c} side="behind" />,
  Front: ({ c }) => <Caption c={c} side="front" />,
  frontDepth: 'screen',   // front captions are read, not filmed: they keep their size through a punch-in
};

// ---------- window cards ----------
// A row of retro desktop windows (each showing one of your reels) slides in under your chin like a conveyor, a cursor
// flies in and clicks one; it grows to the centre while the others slide away, holds, then everything drops out.
// Written in the frames of a 54-frame (1.8 s) reference.
const CLICK = 16;
const WinButton: React.FC<{ s: number; kind: number }> = ({ s, kind }) => (
  <div style={{ width: s, height: s * 0.88, background: '#c3c3c3', boxShadow: 'inset -1px -1px #0a0a0a, inset 1px 1px #fff, inset -2px -2px #808080', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width={s * 0.55} height={s * 0.5} viewBox="0 0 10 9">
      {kind === 0 ? <rect x="1" y="7" width="6" height="2" fill="#000" />
        : kind === 1 ? <rect x="1" y="0.8" width="8" height="7.4" fill="none" stroke="#000" strokeWidth="1.6" />
        : <path d="M1.5 1 L8.5 8 M8.5 1 L1.5 8" stroke="#000" strokeWidth="1.8" />}
    </svg>
  </div>
);
const RetroWindow: React.FC<{ w: number; h: number; src?: string; title: string; i: number }> = ({ w, h, src, title, i }) => {
  const b = Math.max(3, w * 0.016), th = h * 0.075;
  return (
    <div style={{
      width: w, height: h, padding: b, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: '#c3c3c3',
      boxShadow: 'inset -2px -2px #0a0a0a, inset 2px 2px #fff, inset -4px -4px #808080, inset 4px 4px #dfdfdf, 0 24px 60px rgba(0,0,0,0.38)',
    }}>
      <div style={{
        height: th, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: th * 0.3, padding: `0 ${th * 0.12}px 0 ${th * 0.25}px`,
        background: 'linear-gradient(90deg, #000080, #1084d0)', color: '#fff', fontFamily: FONT.ui, fontWeight: 700, fontSize: th * 0.52,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <div style={{ display: 'flex', gap: th * 0.06, flex: 'none' }}>{[0, 1, 2].map((k) => <WinButton key={k} s={th * 0.78} kind={k} />)}</div>
      </div>
      <div style={{ flex: 1, marginTop: b, position: 'relative', overflow: 'hidden', boxShadow: 'inset 2px 2px #808080, inset -2px -2px #fff', background: '#1e1e1e' }}>
        {src ? <Img src={cardSrc(src)} style={{ position: 'absolute', inset: 2, width: 'calc(100% - 4px)', height: 'calc(100% - 4px)', objectFit: 'cover' }} />
          : <div style={{ position: 'absolute', inset: 2, background: `linear-gradient(160deg, hsl(${(i * 67) % 360} 55% 55%), hsl(${(i * 67 + 50) % 360} 60% 30%))` }} />}
      </div>
    </div>
  );
};
const Cursor: React.FC<{ s: number }> = ({ s }) => (
  <svg width={s} height={s * 1.6} viewBox="0 0 13 21" style={{ filter: 'drop-shadow(1px 3px 3px rgba(0,0,0,0.4))' }}>
    <path d="M0.5 0.5 L0.5 17 L4.4 13.3 L7 19.6 L9.6 18.5 L7.1 12.4 L12.4 12.4 Z" fill="#fff" stroke="#000" strokeWidth="1" strokeLinejoin="round" />
  </svg>
);
const WindowCards: React.FC<{ c: FxCtx }> = ({ c }) => {
  const f = specFrame(c, 54), { W, H, face } = c, z = zones(c);
  const imgs = list(c, 'images', c.cards);
  const n = clamp(Math.round(opt(c, 'count', Math.max(3, Math.min(4, imgs.length || 4)))), 1, 8);
  const pick = clamp(Math.round(opt(c, 'pick', 2)) - 1, 0, n - 1);
  const grow = opt(c, 'grow', 1.28);
  // sized so the clicked card, grown, still fits the band under the chin
  const b = band(c), cw0 = px(c, 300), ch0 = cw0 * 1.34;
  const s = clamp(b.h / (ch0 * grow + px(c, 20)), 0.55, 1);
  const cw = cw0 * s, ch = ch0 * s, gap = px(c, 26) * s, top = b.top;
  const cx = clamp(face.x, z.margin + (cw * grow) / 2, rightEdge(c, top, top + ch * grow) - (cw * grow) / 2);
  const slide = (1 - e('expo.out', f, 0, 12)) * W * 1.1;              // the conveyor comes in from the right
  const g = e('expo.out', f, CLICK + 1, 8);                           // after the click: the pick grows, the rest leave
  const press = f >= CLICK && f < CLICK + 2 ? 0.96 : 1;
  const out = fr(f, 44, 54, 'power2.in');
  const drift = Math.sin(f * 0.12) * px(c, 4) * g;
  const titles = list(c, 'titles', []);
  const titleOf = (i: number) => titles[i] ?? str(c, 'title', '') ?? '';
  const name = (i: number) => titleOf(i) || `reel_0${i + 1}.mp4`;
  const pickX = cx + slide, pickS = lerp(1, grow, g) * press;
  // the cursor flies in from the bottom right, lands on the pick, clicks, then rides on it
  const rel = { x: cw * 0.16, y: ch * 0.45 };
  const ck = e('expo.out', f, 5, 10);
  const tx = pickX + rel.x * pickS, ty = top + drift + rel.y * pickS;
  const curX = lerp(W * 1.02, tx, ck), curY = lerp(H * 0.97, ty, ck);
  const cs = (f >= CLICK && f < CLICK + 2 ? 0.82 : 1) * px(c, 44) * s;
  return (
    <AbsoluteFill>
      <VBlurDefs />
      <AbsoluteFill style={exitStyle('drop', out, c)}>
        {Array.from({ length: n }, (_, i) => {
          const d = i - pick;
          const x = cx + d * (cw + gap) + slide + Math.sign(d) * g * W * 0.8;
          const sc = i === pick ? pickS : 1;
          return (
            <div key={i} style={{
              position: 'absolute', left: x - cw / 2, top: top + (i === pick ? drift : 0), transform: `scale(${sc})`, transformOrigin: '50% 0',
              zIndex: i === pick ? 2 : 1,
            }}>
              <RetroWindow w={cw} h={ch} src={imgs.length ? imgs[i % imgs.length] : undefined} title={name(i)} i={i} />
            </div>
          );
        })}
        {f >= 5 ? <div style={{ position: 'absolute', left: curX, top: curY, zIndex: 3 }}><Cursor s={cs} /></div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const WINDOW_CARDS: FxDef = {
  desc: 'Retro desktop windows with your reels slide in under your chin like a conveyor, a cursor clicks one, it grows to the centre, then they all drop out (1.8 s)',
  options: 'images (folder, default thumbs), count (4), pick (2), grow (1.28), title, titles (one per card, with |)',
  Front: WindowCards,
};

// ---------- name tag (lower third) ----------
// An outlined pill with your name and role, open on the left: it slides in from the left edge, focusing as it comes,
// and slides back out the same way.
const LowerThird: React.FC<{ c: FxCtx }> = ({ c }) => {
  const z = zones(c), { face } = c;
  const inK = e('expo.out', c.t, 0, 0.3), out = e('power2.in', c.t, c.d - 0.25, 0.25);
  const h = px(c, 96);
  const yo = str(c, 'y', '');
  const y = clamp(yo ? Number(yo) * c.H : chin(c) + face.w * 1.0, z.top, z.bottom - h);
  const travel = px(c, 760);
  return (
    <div style={{
      position: 'absolute', left: -px(c, 40), top: y, height: h, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: `0 ${px(c, 46)}px 0 ${px(c, 40) + z.margin * 0.55}px`, borderRadius: `0 ${h}px ${h}px 0`,
      border: `${px(c, 2.5)}px solid rgba(255,255,255,0.62)`, borderLeft: 'none',
      background: 'rgba(16,16,16,0.16)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      color: '#fff', fontFamily: FONT.ui, whiteSpace: 'nowrap', textShadow: '0 2px 10px rgba(0,0,0,0.3)',
      transform: `translateX(${-(1 - inK) * travel - out * travel}px)`, filter: inK < 0.999 || out > 0 ? `blur(${((1 - inK) + out) * px(c, 10)}px)` : undefined,
    }}>
      <div style={{ fontSize: px(c, 40), fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{str(c, 'name', 'Your Name')}</div>
      <div style={{ fontSize: px(c, 27), fontWeight: 500, color: 'rgba(255,255,255,0.86)', lineHeight: 1.15 }}>{str(c, 'role', 'Creator')}</div>
    </div>
  );
};

export const NAME_TAG: FxDef = {
  desc: 'A lower-third name tag: an outlined pill, open on the left edge, slides in with your name and role and slides back out',
  options: 'name, role (Creator), y (0..1, default under the chin)',
  Screen: LowerThird,
};

// ---------- silhouette intro ----------
// The first frames show you as a flat silhouette over the real room, then the footage cuts in over 2 frames.
const silK = (c: FxCtx) => 1 - e('power1.out', c.t, opt(c, 'frames', 4) / 30, 2 / 30);
const silId = (c: FxCtx) => `fcm-sil-${Math.round(c.o.start * 1000)}`;
const SilhouetteDefs: React.FC<{ c: FxCtx }> = ({ c }) => {
  const k = silK(c);
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id={silId(c)} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feFlood floodColor={str(c, 'color', '#f3eedc')} result="fl" />
        <feComposite in="fl" in2="SourceAlpha" operator="in" result="fill" />
        <feComposite in="fill" in2="SourceGraphic" operator="arithmetic" k1="0" k2={k} k3={1 - k} k4="0" />
      </filter>
    </svg>
  );
};

export const SILHOUETTE_INTRO: FxDef = {
  desc: 'Opens on you as a flat cream silhouette over the real room for a few frames, then the footage cuts in',
  options: 'frames (4), color (#f3eedc)',
  person: (c) => (silK(c) > 0.001 ? `url(#${silId(c)})` : ''),
  Screen: SilhouetteDefs,
};

// ---------- bottom fade ----------
const fadeK = (c: FxCtx) => e('sine.inOut', c.t, 0, 0.4) * (1 - e('sine.inOut', c.t, c.d - 0.4, 0.4));
export const BOTTOM_FADE: FxDef = {
  desc: 'The bottom of the frame fades to dark so captions and tags read, optionally with the room going soft',
  options: 'amount (0.78), from (0.5 of the height), soft (0 px room blur)',
  room: (c) => { const s = opt(c, 'soft', 0); return s > 0 ? `blur(${s * fadeK(c) * (c.W / 1080)}px)` : ''; },
  // over you but under the captions (list it before them in the plan) and under the Screen tags
  frontDepth: 'screen',
  Front: ({ c }) => {
    const k = fadeK(c), a = opt(c, 'amount', 0.78), from = opt(c, 'from', 0.5) * 100;
    return <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) ${from}%, rgba(0,0,0,${a * 0.55 * k}) ${from + (100 - from) * 0.5}%, rgba(0,0,0,${a * k}) 100%)` }} />;
  },
};
