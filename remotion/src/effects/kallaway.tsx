import React from 'react';
import { AbsoluteFill } from 'remotion';
import { clamp, e, faceAt, fr, FxCtx, FxDef, list, opt, specFrame, str } from '../lib/core';
import { FONT } from '../lib/fonts';

// The Kallaway split, "you're the peak": the clip plays full frame, then drops into a card on printed grid paper. The
// card's top edge is the chart's ground: bars rise out from behind it as a skyline that peaks right behind your head,
// your best number in the one accent colour, the rest hatched in ink falling away to both sides. Your head breaks out
// over the card (the card clips the room, not you), so the hero bar grows out from behind you.
// Reference length 120 frames (4 s): 0-12 plain clip, 12-24 the drop (blurred along its speed, the shadow tightening as
// it lands), 18-30 title, bars from 28 from the outside in, the hero last after a beat, 64-74 a marker loop circles it,
// hold, 110-120 the card opens back to full frame and swallows the chart.

const REF = 120;
const px = (c: FxCtx, v: number) => (v * c.W) / 1080;
const INK = '#1b1713', PAPER = '#f2ece1', HERO = '#D97757', MARK = '#c8432c';

type Bar = { label: string; raw: string; v: number };
const parse = (s: string) => {
  const m = s.trim().match(/^(-?[\d.,]+)\s*([kKmMbB]?)/);
  if (!m) return 0;
  return parseFloat(m[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase() as 'k' | 'm' | 'b'] ?? 1);
};
const short = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(v < 1e7 ? 1 : 0)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${Math.round(v)}`);
const DEFAULT_BARS = 'Data:197K|Data 2:140K|Scroll:124K|Resume:82K|Fable:49K|Jev:38K|LinkedIn:33K';

/** Where the card sits and how the shot is placed in it. Placed from your face at the effect's first frame, so it never jitters. */
export function layout(c: FxCtx) {
  const { W, H } = c;
  const m = px(c, 40), cardY = H * opt(c, 'card', 0.545), s = opt(c, 'scale', 0.96);
  const f0 = faceAt(c.track, Math.round(c.o.start * c.fps));
  const target = cardY + opt(c, 'pop', 0.45) * f0.w * s;      // your face sits just under the card's top edge: the head pops out
  const dy = Math.max(H * (1 - s), target - s * f0.y);        // the shot always covers the card's bottom
  const dx = clamp(W / 2 - s * f0.x, m + (W - 2 * m) - s * W, m);
  // hx / top: where your head lands on screen once the card is down
  return { m, cardY, s, dx, dy, x: m, y: cardY, w: W - 2 * m, r: px(c, 64), hx: dx + s * f0.x, top: dy + s * f0.top };
}
const splitAt = (f: number) => e('expo.out', f, 12, 12) * (1 - fr(f, 110, 120, 'power2.in'));
const splitK = (c: FxCtx) => splitAt(specFrame(c, REF));
/** Vertical motion blur of the drop: how far the shot travels in half a frame (180-degree shutter). */
const dropBlur = (c: FxCtx) => {
  const f = specFrame(c, REF), step = (REF / (c.d * c.fps)) * 0.5;
  const v = Math.abs(splitAt(f + step) - splitAt(f - step)) * (layout(c).dy + c.H * 0.1);
  return Math.min(9, v * 0.1);
};

function bars(c: FxCtx): Bar[] {
  return list(c, 'bars', DEFAULT_BARS.split('|')).map((b) => {
    const i = b.lastIndexOf(':');
    const raw = i > 0 ? b.slice(i + 1).trim() : b, label = i > 0 ? b.slice(0, i).trim() : '';
    return { label, raw, v: parse(raw) };
  });
}

/** The skyline: slots across the page, the biggest bar in the slot under your head, the rest by rank further out. */
function skyline(c: FxCtx, n: number, hx: number) {
  const plotL = px(c, 104), plotR = px(c, 940), slot = (plotR - plotL) / n;
  const peak = clamp(Math.floor((hx - plotL) / slot), 0, n - 1);
  // nearest first; on a tie the side with more room goes first, so the ranks alternate around you
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    Math.abs(a - peak) - Math.abs(b - peak) || (peak < n / 2 ? b - a : a - b));
  return { plotL, slot, order };
}

/** A hand-drawn marker loop: a little more than one turn, slightly wobbly, so the pen overshoots its start. */
const loopPath = (cx: number, cy: number, rx: number, ry: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const a = -2.3 + (i / 48) * (Math.PI * 2 + 0.55);
    const w = 1 + 0.045 * Math.sin(a * 3 + 0.7) - 0.03 * (i / 48);
    pts.push(`${(cx + Math.cos(a) * rx * w).toFixed(1)},${(cy + Math.sin(a) * ry * w + (i / 48) * ry * 0.12).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
};

const Chart: React.FC<{ c: FxCtx }> = ({ c }) => {
  const f = specFrame(c, REF), { W, H } = c;
  const L = layout(c), k = splitK(c);
  const data = bars(c);
  const n = data.length, max = Math.max(...data.map((d) => d.v), 1);
  const rank = data.map((_, i) => i).sort((a, b) => data[b].v - data[a].v);   // data index by rank
  const { plotL, slot, order } = skyline(c, n, L.hx);
  const slotOf = (i: number) => order[rank.indexOf(i)];
  const hero = rank[0];
  // bars arrive from the outside in, the hero last after a beat: hold before what matters
  const at = (i: number) => (i === hero ? 28 + (n - 1) * 3 + 5 : 28 + (n - 1 - rank.indexOf(i)) * 3);
  const heroLand = at(hero) + 13;
  const base = L.cardY, plotT = px(c, 640), plotH = base - plotT, bw = slot * 0.64;
  const line = (i: number) => e('expo.out', f, 18 + i * 3, 7);
  const under = fr(f, 27, 37, 'power3.out');
  const leave = fr(f, 110, 120, 'power2.in');
  const lift = fr(f, 30, 110, 'sine.inOut') * px(c, 14);     // the title keeps drifting up through the hold
  const title = str(c, 'title', `My top ${n} reels`), accent = str(c, 'accent', 'views'), by = str(c, 'by', 'by');
  const hatch = `repeating-linear-gradient(135deg, ${INK} 0 ${px(c, 3)}px, rgba(27,23,19,0.06) ${px(c, 3)}px ${px(c, 10)}px)`;
  return (
    <AbsoluteFill style={{ opacity: k > 0.02 ? 1 : 0 }}>
      {/* title: each line rises out of its own mask */}
      <div style={{ position: 'absolute', left: px(c, 64), top: px(c, 282) - lift - leave * px(c, 60), fontFamily: FONT.ui, fontWeight: 800, color: INK, fontSize: px(c, 76), letterSpacing: -px(c, 2.6), lineHeight: 1.04 }}>
        <div style={{ overflow: 'hidden', paddingBottom: px(c, 4) }}><div style={{ transform: `translateY(${(1 - line(0)) * 110}%)` }}>{title}</div></div>
        <div style={{ overflow: 'hidden', paddingBottom: px(c, 22) }}>
          <div style={{ transform: `translateY(${(1 - line(1)) * 110}%)` }}>
            {by}{' '}
            <span style={{ position: 'relative', fontFamily: FONT.serif, fontStyle: 'italic', fontWeight: 400, fontSize: px(c, 92), letterSpacing: 0, color: HERO }}>
              {accent}
              {/* a marker stroke, drawn left to right */}
              <svg viewBox="0 0 100 12" preserveAspectRatio="none" style={{ position: 'absolute', left: -px(c, 6), width: `calc(100% + ${px(c, 12)}px)`, bottom: -px(c, 6), height: px(c, 18), overflow: 'visible' }}>
                <path d="M2,7 C22,3 48,9 70,5 S92,4 98,6" pathLength={1} fill="none" stroke={MARK} strokeWidth={4.2} strokeLinecap="round"
                  strokeDasharray="1 1" strokeDashoffset={1 - under} />
              </svg>
            </span>
          </div>
        </div>
      </div>
      {/* bars: they stand on the card's top edge and rise out from behind it */}
      {data.map((d, i) => {
        const a = at(i);
        if (f < a) return null;
        const isHero = i === hero, g = e('expo.out', f, a, isHero ? 13 : 10);
        const hgt = Math.max(px(c, 30), (d.v / max) * plotH) * g, cx = plotL + slot * (slotOf(i) + 0.5);
        const val = isHero ? px(c, 84) : Math.min(px(c, 50), slot * 0.46);
        const nameSize = Math.min(px(c, isHero ? 30 : 26), (slot * (isHero ? 1.5 : 0.96)) / Math.max(4, d.label.length * 0.55));
        const shown = g >= 1 ? d.raw.toUpperCase().replace(/\s+/g, '') : short(d.v * g);
        const gap = isHero ? val * 0.34 : px(c, 4);           // the hero's name sits clear of the marker loop
        const labelTop = base - hgt - val - gap - nameSize * 1.25 - px(c, 10);
        const w = isHero ? slot * 2 : slot;
        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'absolute', left: cx - bw / 2, width: bw, top: base - hgt, height: hgt + px(c, 6),
              borderRadius: `${px(c, 10)}px ${px(c, 10)}px 0 0`, boxSizing: 'border-box',
              background: isHero ? HERO : hatch, border: isHero ? 'none' : `${px(c, 3)}px solid ${INK}`, borderBottom: 'none',
              boxShadow: isHero ? `inset 0 ${px(c, 5)}px 0 rgba(255,255,255,0.22)` : 'none',
            }} />
            <div style={{ position: 'absolute', left: cx - w / 2, width: w, top: labelTop, textAlign: 'center', opacity: clamp((f - a) / 2) }}>
              <div style={{ fontFamily: FONT.anton, fontSize: val, lineHeight: 1, color: INK, letterSpacing: px(c, 0.5), fontVariantNumeric: 'tabular-nums' }}>{shown}</div>
              <div style={{ fontFamily: FONT.ui, fontWeight: isHero ? 800 : 700, fontSize: nameSize, lineHeight: 1.25, color: isHero ? INK : '#6d665d', whiteSpace: 'nowrap', marginTop: gap }}>{d.label}</div>
            </div>
            {isHero ? (
              <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                <path d={loopPath(cx, labelTop + val * 0.5, Math.min(slot * 0.95, val * 1.28), val * 0.7)} pathLength={1} fill="none" stroke={MARK}
                  strokeWidth={px(c, 6)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1"
                  strokeDashoffset={1 - fr(f, heroLand + 1, heroLand + 11, 'power3.out')} />
              </svg>
            ) : null}
          </React.Fragment>
        );
      })}
      {/* the card's shadow on the paper (behind the shot): wide and soft while it drops, tight once it lands */}
      <div style={{
        position: 'absolute', left: L.x * k, width: W - 2 * L.x * k, top: L.cardY * k, height: H,
        borderRadius: `${L.r * k}px ${L.r * k}px 0 0`,
        boxShadow: `0 -${px(c, 4 + 18 * (1 - k))}px ${px(c, 28 + 80 * (1 - k))}px rgba(60,40,20,${0.26 * k})`,
      }} />
    </AbsoluteFill>
  );
};

const Paper: React.FC<{ c: FxCtx }> = ({ c }) => {
  const g = px(c, 38), line = 'rgba(80,60,30,0.07)', blur = dropBlur(c);
  return (
    <AbsoluteFill style={{
      backgroundColor: PAPER,
      backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      backgroundSize: `${g}px ${g}px`, backgroundPosition: `${px(c, 8)}px ${px(c, 12)}px`,
    }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="kw-drop" x="-2%" y="-8%" width="104%" height="116%"><feGaussianBlur stdDeviation={`0 ${blur.toFixed(2)}`} /></filter>
      </svg>
      {/* print grain, so the page reads as paper and not a flat fill (seeded: same frame, same grain) */}
      <svg width={c.W} height={c.H} style={{ position: 'absolute', inset: 0, opacity: 0.32, mixBlendMode: 'multiply' }}>
        <filter id="kw-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} /><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.18  0 0 0 0.55 0" /></filter>
        <rect width="100%" height="100%" filter="url(#kw-grain)" />
      </svg>
      <Chart c={c} />
    </AbsoluteFill>
  );
};

export const KALLAWAY: FxDef = {
  desc: 'Kallaway split: the clip drops into a card on grid paper and your numbers rise out of its top edge as a skyline that peaks behind your head (4 s)',
  options: 'bars (Label:Value|..., e.g. Data:197K|Scroll:124K), title (My top N reels), by (by), accent (views), pop (0.45), card (0.545 = card top), scale (0.96)',
  card: (c) => ({ k: splitK(c), ...layout(c) }),
  // the drop smears along its speed, like a real camera would
  world: (c) => (dropBlur(c) > 0.4 ? 'url(#kw-drop)' : ''),
  // a soft contact shadow where your head sits over the paper
  person: (c) => { const k = splitK(c); return k > 0.01 ? `drop-shadow(0 ${px(c, 14)}px ${px(c, 26)}px rgba(60,40,20,${0.25 * k}))` : ''; },
  Backdrop: Paper,
};
