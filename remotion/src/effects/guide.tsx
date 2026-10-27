import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { clamp, e, fr, FxCtx, FxDef, lerp, list, opt, specFrame, str } from '../lib/core';
import { FONT } from '../lib/fonts';
import { useFitSize } from '../lib/assets';
import { KALLAWAY } from './kallaway';
import { arrive, band, chin, ORANGE, px, rightEdge, smoked, zones } from '../lib/layout';
import { exitStyle } from './reels';

// The library's effects that are written against a set length, built on the layer stack and directed by
// docs/motion-rules.md (distilled from pro-animation-director). Each is written in 30 fps frame numbers of its reference
// length (specFrame), so a longer window slows every move to match.
// The rules, as they show up here: entries do most of their travel in the first 4-8 frames and exits ease in; things
// arrive by moving, unmasking or focusing instead of fading; one visible spring in the whole set (the freeze-frame pop);
// no light flashes; every hold keeps one living thing; nothing in the platform zones; never over the face.

// ---------- numbers: "1,204" -> "412K", formatted the way the target is written ----------
const parseNum = (s: string) => {
  const m = s.trim().match(/^([^\d-]*)(-?[\d.,]+)\s*([kKmMbB]?)(.*)$/);
  if (!m) return { pre: '', v: 0, unit: '', post: s };
  const mul = { k: 1e3, m: 1e6, b: 1e9 }[m[3].toLowerCase() as 'k' | 'm' | 'b'] ?? 1;
  return { pre: m[1], v: parseFloat(m[2].replace(/,/g, '')) * mul, unit: m[3].toUpperCase(), post: m[4] };
};
const showNum = (v: number, unit: string) => {
  if (unit === 'M' && v >= 1e6) return `${(v / 1e6).toFixed(v < 1e7 ? 1 : 0)}M`;
  if ((unit === 'K' || unit === 'M') && v >= 1e4) return `${Math.round(v / 1e3)}K`;
  return Math.round(v).toLocaleString('en-US');
};
const countUp = (from: string, to: string, k: number) => {
  const a = parseNum(from), b = parseNum(to);
  return { num: k >= 1 ? `${b.pre}${showNum(b.v, b.unit)}` : `${b.pre}${showNum(lerp(a.v, b.v, k), b.unit)}`, post: b.post };
};
const splitValue = (v: string) => { const m = v.match(/^([^a-zA-Z]*[\d.,]+\s*[kKmMbB]?)\s*(.*)$/); return m ? [m[1], m[2]] : [v, '']; };

// ---------- 1. over the shoulder ----------
// Cards sit beside your head, tucked a little behind it, above the right rail. They slide out from behind your head
// (unmasked by it), and tuck back behind it at the end. The camera pushes over each shoulder with motion blur.
const otsCards = (c: FxCtx) => {
  const { face } = c, z = zones(c), w = px(c, 300), h = px(c, 210);
  const headL = face.x - face.w * 0.56, headR = face.x + face.w * 0.56;   // hair is wider than the face box
  const bottom = Math.min(face.y + face.w * 0.95, z.railY0 - px(c, 10));
  const y = Math.max(z.top + px(c, 20), bottom - h);
  return {
    w, h, y,
    L: { x: Math.max(z.margin, headL - 0.9 * w), home: face.x - w / 2 },     // tucked ~10 % behind your head
    R: { x: Math.min(c.W - z.margin - w, headR - 0.1 * w), home: face.x - w / 2 },
  };
};
const OTS_KEYS: [number, number, number][] = [   // [guide frame, zoom, where: -1 left card, 0 centre, 1 right card]
  [0, 1, 0], [5, 1, 0], [20, 1.3, -1], [27, 1.3, -0.96], [36, 1.12, 0], [46, 1.3, 1], [55, 1.3, 0.96], [70, 1, 0], [84, 1, 0],
];
function otsCamera(c: FxCtx) {
  const f = specFrame(c, 84), k = otsCards(c);
  let i = 0; while (i < OTS_KEYS.length - 2 && f > OTS_KEYS[i + 1][0]) i++;
  const [f0, z0, s0] = OTS_KEYS[i], [f1, z1, s1] = OTS_KEYS[i + 1];
  const u = fr(f, f0, f1, 'power2.inOut');
  const z = lerp(z0, z1, u), side = lerp(s0, s1, u), a = Math.abs(side);
  // aim so the card in focus lands in the hero zone, bottom at ~800 px on screen (clear of the rail)
  const zz = Math.max(1.0001, z), cardY0 = k.y + k.h - px(c, 800) / zz;
  const tx = side < 0 ? k.L.x + k.w / 2 : k.R.x + k.w / 2, ty = cardY0 + c.H / (2 * zz);
  return { zoom: z, cx: lerp(c.W / 2, tx, a), cy: lerp(c.H / 2, ty, a) + Math.sin(f * 0.21) * 2.5, parallax: opt(c, 'parallax', 0.35) };
}
const ProofCard: React.FC<{ c: FxCtx; x: number; y: number; label: string; value: string; side: 1 | -1; k: number; tuck: number }> = ({ c, x, y, label, value, side, k, tuck }) => {
  const { w, h } = otsCards(c);
  const [num, unit] = splitValue(value);
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', padding: `${px(c, 24)}px ${px(c, 28)}px`,
      ...smoked(c), textAlign: side < 0 ? 'left' : 'right',           // text on the outer side, clear of your head
      transform: `scale(${lerp(1.12, 1, k) - 0.06 * tuck}) rotate(${(1 - k) * -6 * side}deg)`, transformOrigin: side < 0 ? '100% 60%' : '0% 60%',
      opacity: clamp(k * 6) * (1 - clamp((tuck - 0.85) / 0.15)),
    }}>
      <div style={{ fontSize: px(c, 28), fontWeight: 600, color: 'rgba(255,255,255,0.62)' }}>{label}</div>
      <div style={{ fontSize: px(c, 74), fontWeight: 800, letterSpacing: -px(c, 2.5), lineHeight: 1.02, whiteSpace: 'nowrap' }}>{num}</div>
      {unit ? <div style={{ fontSize: px(c, 28), fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>{unit}</div> : null}
    </div>
  );
};
const OverShoulder: React.FC<{ c: FxCtx }> = ({ c }) => {
  const f = specFrame(c, 84), k = otsCards(c);
  const out = fr(f, 70, 82, 'power2.in');                                     // tuck back behind your head, accelerating
  const card = (side: 1 | -1, at: number, label: string, value: string) => {
    const home = side < 0 ? k.L : k.R;
    const kin = e('expo.out', f, at, 7);                                        // slides out from behind your head
    if (f < at) return null;
    const x = lerp(home.home, home.x, kin * (1 - out));
    const y = k.y + Math.sin(f * 0.11 + side) * px(c, 3) + out * px(c, 24);   // a slow bob while it holds
    return <ProofCard c={c} x={x} y={y} label={label} value={value} side={side} k={kin} tuck={out} />;
  };
  return (
    <AbsoluteFill>
      {card(-1, 9, str(c, 'before_label', 'Before'), str(c, 'before', '1,204 views'))}
      {card(1, 39, str(c, 'after_label', 'After'), str(c, 'after', '412K views'))}
    </AbsoluteFill>
  );
};

// ---------- 2. glass graph ----------
const GRAPH = [0.04, 0.1, 0.08, 0.2, 0.28, 0.24, 0.38, 0.5, 0.45, 0.6, 0.72, 0.68, 0.85, 1];
const GlassGraph: React.FC<{ c: FxCtx }> = ({ c }) => {
  const f = specFrame(c, 90), { W, H } = c;
  const b = band(c);
  const w = px(c, 760), h = clamp(b.h, px(c, 360), px(c, 520));
  const x = clamp((W - w) / 2 + (c.face.x - W / 2) * 0.12, zones(c).margin, rightEdge(c, b.top, b.top + h) - w);
  const y = Math.max(chin(c), Math.min(b.top, zones(c).bottom - h));
  const inK = e('expo.out', f, 0, 8), outK = fr(f, 80, 90, 'power2.in');
  const k = fr(f, 8, 26, 'power3.out');                         // 18 frames, lands exactly on the value; the line draws with it
  const { num, post } = countUp(str(c, 'from', '1,204'), str(c, 'to', '412K'), k);
  const pad = px(c, 44), big = h >= px(c, 440) ? px(c, 116) : px(c, 100);
  const gw = w - pad * 2, gh = h - pad * 2 - px(c, 36) - big * 1.08;
  const pts = GRAPH.map((v, i) => [(i / (GRAPH.length - 1)) * gw, (1 - v) * gh * 0.9 + gh * 0.05]);
  const path = pts.map(([a, bb], i) => `${i ? 'L' : 'M'}${a.toFixed(1)},${bb.toFixed(1)}`).join(' ');
  const tipX = k * gw, seg = Math.min(GRAPH.length - 2, Math.floor(k * (GRAPH.length - 1)));
  const tipY = lerp(pts[seg][1], pts[seg + 1][1], k * (GRAPH.length - 1) - seg);
  const pulse = fr(f, 26, 40, 'power2.out');                    // the one accent: the dot pulses as the number lands
  const shimmer = ((f - 26) / 40) % 1;                          // a glint keeps travelling the line while it holds
  const col = str(c, 'color', ORANGE);
  return (
    <div style={{
      position: 'absolute', left: x, top: y + (1 - inK) * px(c, 140) + outK * (H - y + px(c, 40)), width: w, height: h, boxSizing: 'border-box',
      padding: pad, borderRadius: px(c, 36), opacity: clamp(f / 2),
      background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.3)',
      backdropFilter: 'blur(34px) saturate(160%)', WebkitBackdropFilter: 'blur(34px) saturate(160%)',
      boxShadow: '0 40px 80px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)', fontFamily: FONT.ui, color: '#fff',
    }}>
      <div style={{ fontSize: px(c, 32), fontWeight: 600, color: 'rgba(255,255,255,0.78)', lineHeight: 1.1 }}>{str(c, 'text', 'Views this month')}</div>
      <div style={{ fontSize: big, fontWeight: 800, letterSpacing: -px(c, 4), lineHeight: 1.08, textShadow: '0 4px 24px rgba(0,0,0,0.25)', fontVariantNumeric: 'tabular-nums' }}>
        {num}<span style={{ fontSize: px(c, 40), fontWeight: 700, letterSpacing: 0 }}>{post}</span>
      </div>
      <svg width={gw} height={gh} style={{ position: 'absolute', left: pad, bottom: pad, overflow: 'visible' }}>
        <defs>
          <linearGradient id="gg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity="0.34" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient>
          <linearGradient id="gg-glint" x1="0" y1="0" x2={gw} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset={clamp(shimmer - 0.08)} stopColor={col} /><stop offset={clamp(shimmer)} stopColor="#ffe3d6" /><stop offset={clamp(shimmer + 0.08)} stopColor={col} />
          </linearGradient>
          <clipPath id="gg-clip"><rect x={-10} y={-20} width={tipX + 10} height={gh + 40} /></clipPath>
        </defs>
        <g clipPath="url(#gg-clip)">
          <path d={`${path} L${gw},${gh} L0,${gh} Z`} fill="url(#gg-fill)" />
          <path d={path} fill="none" stroke={f > 26 ? 'url(#gg-glint)' : col} strokeWidth={px(c, 7)} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 ${px(c, 9)}px ${col})` }} />
        </g>
        {k > 0.01 ? (
          <>
            {pulse > 0 && pulse < 1 ? <circle cx={tipX} cy={tipY} r={px(c, 14) * (1 + 1.8 * pulse)} fill="none" stroke={col} strokeWidth={px(c, 4)} opacity={1 - pulse} /> : null}
            <circle cx={tipX} cy={tipY} r={px(c, 12)} fill="#fff" stroke={col} strokeWidth={px(c, 5)} style={{ filter: `drop-shadow(0 0 ${px(c, 12)}px ${col})` }} />
          </>
        ) : null}
      </svg>
    </div>
  );
};

// ---------- 3. freeze frame ----------
const FREEZE_AT = 15, RELEASE = 60, RELEASED = 72;
const greyK = (c: FxCtx) => { const f = specFrame(c, 90); return fr(f, FREEZE_AT, FREEZE_AT + 12, 'sine.inOut') * (1 - fr(f, RELEASE, RELEASED, 'sine.inOut')); };
const NameTag: React.FC<{ c: FxCtx }> = ({ c }) => {
  const f = specFrame(c, 90), { face } = c, z = zones(c);
  const a = arrive(f, FREEZE_AT + 6);
  const out = fr(f, RELEASE, RELEASE + 8, 'power2.in');
  if (!a.on || out >= 1) return null;
  const w = px(c, 500), h = px(c, 150);
  const y = Math.min(face.y + face.w * 1.75, z.bottom - h - px(c, 24)) + Math.sin(f * 0.13) * px(c, 3) + out * px(c, 70);
  const x = clamp(face.x - w / 2, z.margin, rightEdge(c, y, y + h) - w);
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, height: h, ...smoked(c, 75), background: 'rgba(14,12,12,0.78)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transform: `${a.transform} scale(${1 - 0.1 * out})`, opacity: a.opacity * (1 - clamp((out - 0.7) / 0.3)),
    }}>
      <div style={{ fontSize: px(c, 54), fontWeight: 800, letterSpacing: -px(c, 1), lineHeight: 1.1 }}>{str(c, 'name', 'Your Name')}</div>
      <div style={{ fontSize: px(c, 28), fontWeight: 500, color: 'rgba(255,255,255,0.68)', marginTop: px(c, 2) }}>{str(c, 'role', 'Creator')}</div>
    </div>
  );
};
const Flash: React.FC<{ c: FxCtx }> = ({ c }) => {
  if (str(c, 'flash', '0') === '0') return null;                 // off by default: light stays stable
  const f = specFrame(c, 90);
  const a = f < FREEZE_AT ? 0 : 0.8 * (1 - fr(f, FREEZE_AT, FREEZE_AT + 6, 'power1.out'));
  return a > 0.001 ? <AbsoluteFill style={{ background: '#fff', opacity: a }} /> : null;
};

// ---------- 4. tier list ----------
// The classic creator tier list (the TierMaker look): pastel rounded letter tiles with a dark letter, a long charcoal bar
// per row, items as plain white text (or logo tiles). All rows the same height, like the template everyone recognises.
const TIERS: [string, string][] = [['S', '#f28b8b'], ['A', '#f5c18d'], ['B', '#fbfb8f'], ['C', '#a8f5a0'], ['D', '#9fd3f5']];
const DEFAULT_TIERS: Record<string, string> = { S: 'Claude', A: 'ChatGPT|Gemini|Cursor', B: 'Perplexity|Midjourney', C: 'Grok|DeepSeek', D: 'Meta' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const Spinner: React.FC<{ size: number; t: number }> = ({ size, t }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${t * 540}deg)` }}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
    <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
const TierList: React.FC<{ c: FxCtx }> = ({ c }) => {
  const f = specFrame(c, 90), { H } = c, z = zones(c);
  const logos = list(c, 'logos', []);
  const logoFor = (name: string) => logos.find((l) => slug(l.split('/').pop()!.replace(/\.[a-z]+$/i, '')) === slug(name));
  const rows = TIERS.map(([t, col]) => ({ t, col, items: list(c, t, list(c, t.toLowerCase(), (DEFAULT_TIERS[t] || '').split('|'))) }));
  let n = 0; const order = rows.map((r) => r.items.map(() => n++));
  const last = 10 + (n - 1) * 4;
  // designed at full size; heights and type shrink to fit the band under the chin (down to 0.72), the width stays full
  const head = 60, row = 74, gap = 9, pad = 14;
  const H0 = head + 5 * row + 4 * gap + pad * 2;
  const b = band(c);
  const s = clamp(b.h / px(c, H0), 0.72, 1) * (c.W / 1080);
  const w = px(c, 840), h = H0 * s;
  const y = Math.max(chin(c) - px(c, 6), Math.min(b.top, z.bottom - h));
  const x = clamp((c.W - w) / 2, z.margin, rightEdge(c, y, y + h) - w);
  const inK = e('expo.out', f, 0, 8), outK = fr(f, 80, 90, 'power2.in');
  const swap = fr(f, last + 6, last + 12, 'expo.out');             // the status line rolls over, never two labels on top
  const S = (v: number) => v * s;
  return (
    <div style={{
      position: 'absolute', left: x, top: y + (1 - inK) * S(130) + outK * (H - y + S(40)), width: w, height: h, boxSizing: 'border-box',
      padding: S(pad), borderRadius: S(22), opacity: clamp(f / 2), fontFamily: FONT.ui, color: '#fff',
      background: 'linear-gradient(180deg, rgba(62,62,64,0.96), rgba(44,44,46,0.96))', boxShadow: '0 30px 70px rgba(0,0,0,0.4)',
    }}>
      <div style={{ height: S(head - gap), position: 'relative', overflow: 'hidden' }}>
        {[0, 1].map((k) => (
          <div key={k} style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S(14),
            fontSize: S(31), fontWeight: 600, transform: `translateY(${(k ? 1 - swap : -swap) * S(head)}px)`, color: k ? ORANGE : 'rgba(255,255,255,0.88)',
          }}>
            {k ? <span style={{ fontWeight: 800 }}>✓</span> : <Spinner size={S(30)} t={c.t} />}
            {k ? 'Ranked' : `Ranking ${str(c, 'text', 'AI tools')}...`}
          </div>
        ))}
      </div>
      {rows.map((r, ri) => {
        // the row answers a frame after an item lands in it: a 3 px nudge
        const landed = r.items.map((_, ii) => 10 + order[ri][ii] * 4 + 6);
        const nudge = landed.reduce((m, at) => Math.max(m, f >= at && f < at + 4 ? Math.sin(((f - at) / 4) * Math.PI) : 0), 0);
        return (
          <div key={r.t} style={{
            position: 'relative', display: 'flex', height: S(row), marginTop: ri ? S(gap) : 0, transform: `translateY(${nudge * S(3)}px)`,
          }}>
            <div style={{ position: 'absolute', left: S(row) * 0.5, right: 0, top: 0, bottom: 0, background: '#262628' }} />
            <div style={{
              position: 'relative', width: S(row), height: S(row), borderRadius: S(12), background: r.col, flex: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.bold, fontSize: S(36), color: '#1b1b1b',
              boxShadow: `0 ${S(3)}px ${S(10)}px rgba(0,0,0,0.35)`,
            }}>{r.t}</div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: S(34), paddingLeft: S(28), minWidth: 0 }}>
              {r.items.map((it, ii) => {
                const at = 10 + order[ri][ii] * 4;
                if (f < at) return null;
                const k = e('expo.out', f, at, 6), squash = f >= at + 5 && f < at + 7 ? 0.9 : 1;   // lands, squashes 2 frames
                const logo = logoFor(it), lh = S(row - 18);
                return (
                  <div key={ii} style={{
                    display: 'flex', alignItems: 'center', height: S(row), flex: 'none', whiteSpace: 'nowrap',
                    fontSize: S(34), fontWeight: ri === 0 ? 700 : 500, letterSpacing: S(0.2),
                    transform: `translateY(${(1 - k) * -S(80)}px) scale(1, ${squash})`, transformOrigin: '50% 80%', opacity: clamp((f - at) / 2),
                  }}>
                    {logo ? <div style={{ width: lh, height: lh, borderRadius: S(10), background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Img src={staticFile(logo)} style={{ width: '82%', height: '82%', objectFit: 'contain' }} /></div> : it}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------- 5. text behind your head ----------
// The word starts hidden behind your body and rises out from behind you, focusing as it comes (no fade);
// it holds with a slow lift, then sinks back behind you.
const TextBehind: React.FC<{ c: FxCtx }> = ({ c }) => {
  const f = specFrame(c, 90), { face, W } = c;
  const text = str(c, 'text', 'VIRAL').toUpperCase();
  const maxW = px(c, 840);
  const fitW = useFitSize(text, FONT.anton, maxW);
  if (!fitW) return null;
  const capH = px(c, opt(c, 'height', 330)), byCap = capH / 0.735;   // Anton's cap height is about 0.735 em
  const size = Math.min(fitW, byCap), wordW = (maxW * size) / fitW;
  const rise = e('expo.out', f, 0, 10), lift = fr(f, 10, 75, 'sine.inOut'), sink = fr(f, 75, 90, 'power2.in');
  const z = zones(c);
  const cx = clamp(face.x, z.margin + wordW / 2, c.W - z.margin - wordW / 2);
  const capMid = Math.max(z.top + capH / 2, face.top + face.w * opt(c, 'y', 0.18));   // the caps straddle the top of your head
  const hidden = chin(c) + capH * 0.9 - capMid;                                         // far enough down that your body covers it
  // exit: sink back behind you (default), or the reel's blow (grows past the camera, going soft) / drop
  const exit = str(c, 'exit', 'sink');
  const dy = (1 - rise) * hidden - lift * px(c, 20) + (exit === 'sink' ? sink * hidden : 0);
  const col = str(c, 'color', c.bright ? '#141418' : '#ffffff');
  const ex = exit === 'sink' ? {} : exitStyle(exit, sink, c);
  const inBlur = (1 - rise) * px(c, 14) + (exit === 'sink' ? sink * px(c, 6) : 0);
  return (
    <div style={{
      position: 'absolute', left: cx - W / 2, width: W, top: capMid - size * 0.62 + dy, textAlign: 'center',
      fontFamily: FONT.anton, fontSize: size, lineHeight: 1, color: col, transformOrigin: `${W / 2}px ${size * 0.62}px`, ...ex,
      filter: [inBlur > 0.05 ? `blur(${inBlur}px)` : '', ex.filter ?? ''].filter(Boolean).join(' ') || undefined,
      textShadow: c.bright ? '0 18px 50px rgba(0,0,0,0.16)' : '0 18px 50px rgba(0,0,0,0.45)',
    }}>{text}</div>
  );
};

// ---------- 6. colour grade ----------
/** The two looks as SVG filters (no plugins): flat LOG-like, and a cinematic teal/warm split tone that keeps skin natural. */
export const GradeFilters: React.FC = () => (
  <>
    <filter id="fcm-flat" colorInterpolationFilters="sRGB">
      <feColorMatrix type="saturate" values="0.5" />
      <feComponentTransfer>
        <feFuncR type="linear" slope="0.7" intercept="0.13" />
        <feFuncG type="linear" slope="0.7" intercept="0.13" />
        <feFuncB type="linear" slope="0.68" intercept="0.15" />
      </feComponentTransfer>
    </filter>
    <filter id="fcm-graded" colorInterpolationFilters="sRGB">
      <feComponentTransfer>
        <feFuncR type="table" tableValues="0 0.03 0.13 0.305 0.53 0.76 0.925 0.99" />
        <feFuncG type="table" tableValues="0 0.05 0.16 0.35 0.56 0.77 0.92 0.98" />
        <feFuncB type="table" tableValues="0.03 0.1 0.21 0.37 0.55 0.73 0.87 0.93" />
      </feComponentTransfer>
      <feColorMatrix type="saturate" values="1.0" />
    </filter>
  </>
);
const wipeX = (c: FxCtx) => fr(specFrame(c, 90), 25, 45, 'sine.inOut') * c.W;
const GradeScreen: React.FC<{ c: FxCtx }> = ({ c }) => {
  const x = wipeX(c), { W, H } = c, z = zones(c);
  const pillTop = px(c, 290);                                    // the headline band, under the platform's top UI
  const pill: React.CSSProperties = {
    position: 'absolute', top: pillTop, height: px(c, 64), padding: `0 ${px(c, 28)}px`, display: 'flex', alignItems: 'center',
    borderRadius: px(c, 32), background: 'rgba(10,10,12,0.74)', color: '#fff', fontFamily: FONT.ui, fontWeight: 700, fontSize: px(c, 32), whiteSpace: 'nowrap',
  };
  const bw = px(c, 150), aw = px(c, 128);
  // the pills ride the line, and the line itself reveals AFTER and wipes BEFORE away (clipped, never faded)
  const bx = clamp(x + px(c, 28), z.margin, W - z.margin - bw), ax = clamp(x - px(c, 28) - aw, z.margin, W - z.margin - aw);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${W - x}px 0 0)`, background: 'radial-gradient(ellipse 80% 65% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.4) 100%)' }} />
      <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${x}px)` }}><div style={{ ...pill, left: bx }}>Before</div></AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${W - x}px 0 0)` }}><div style={{ ...pill, left: ax }}>After</div></AbsoluteFill>
      {x > 0 && x < W ? (
        <div style={{ position: 'absolute', left: x - px(c, 3), top: 0, width: px(c, 6), height: H, background: '#fff',
          boxShadow: `0 0 ${px(c, 18)}px #fff, 0 0 ${px(c, 50)}px rgba(255,236,210,0.9), 0 0 ${px(c, 110)}px rgba(255,214,170,0.6)` }} />
      ) : null}
    </AbsoluteFill>
  );
};

// ---------- registry entries ----------
export const GUIDE: Record<string, FxDef> = {
  'over-the-shoulder': {
    desc: 'The camera pushes in over one shoulder to a Before card, swings to the other for After, then settles; the cards slide out from behind your head (2.8 s)',
    options: 'before (1,204 views), after (412K views), before_label, after_label, parallax (0.35)',
    camera: otsCamera,
    cameraBlur: true,
    Behind: OverShoulder,
  },
  'kallaway-split': KALLAWAY,
  'freeze-frame': {
    desc: 'The shot freezes with a pop, the room greys out, you get a white sticker outline and a name tag, then it lets go (3 s)',
    options: 'name, role (Creator), flash (0 | 1)',
    freeze: (c) => { const f = specFrame(c, 90); return f >= FREEZE_AT && f < RELEASE ? (FREEZE_AT / 90) * c.d : null; },
    // a frozen frame still breathes: a slow push while it holds
    camera: (c) => { const f = specFrame(c, 90); const k = fr(f, FREEZE_AT, RELEASE, 'sine.inOut') * (1 - fr(f, RELEASE, RELEASED, 'power2.inOut')); return { zoom: 1 + 0.035 * k, cx: c.face.x, cy: c.face.y + c.face.w }; },
    room: (c) => { const k = greyK(c); return k > 0 ? `grayscale(${k}) brightness(${1 - 0.4 * k})` : ''; },
    sticker: (c) => { const f = specFrame(c, 90); return 12 * (c.W / 1080) * e('expo.out', f, FREEZE_AT, 6) * (1 - fr(f, RELEASE, RELEASE + 8, 'power2.in')); },
    personScale: (c) => { const f = specFrame(c, 90); return 1 + 0.04 * e('back.out(2.2)', f, FREEZE_AT, 8) * (1 - fr(f, RELEASE, RELEASED)); },
    Front: NameTag,
    Screen: Flash,
  },
  'tier-list': {
    desc: 'A classic creator tier list (pastel S-D tiles, charcoal bars) builds below your face: items drop in one by one, the status rolls to Ranked (3 s)',
    options: 'text (topic: AI tools), S, A, B, C, D (items with |), logos (folder, file names = item names)',
    Front: TierList,
  },
  'text-behind': {
    desc: 'A huge word rises out from behind your body, holds behind your head with a slow lift, then sinks back (3 s)',
    options: 'text (VIRAL), color (auto: white, or ink on a light wall), height (330 px caps), y (0.18), exit (sink | blow | drop)',
    Behind: TextBehind,
    depth: 'screen',
  },
  'color-grade': {
    desc: 'Starts flat like LOG footage, a line of light wipes across and leaves a cinematic grade; Before / After ride the line (3 s)',
    options: '(none)',
    split: (c) => ({ x: wipeX(c), left: 'url(#fcm-graded)', right: 'url(#fcm-flat)' }),
    Screen: GradeScreen,
  },
};

// Glass graph: the frosted proof card with a counter and a line.
export const GLASS_GRAPH: FxDef = {
  desc: 'A frosted glass card rises at chest height, the number counts up in 18 frames and an orange graph draws with it (3 s)',
  options: 'text (Views this month), from (1,204), to (412K), color (#D97757)',
  Front: GlassGraph,
};
