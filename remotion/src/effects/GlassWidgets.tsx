import React from 'react';
import { Img, staticFile } from 'remotion';
import { clamp, e, FxCtx, str, useTimeline } from '../lib/core';
import { FONT } from '../lib/fonts';

// Frosted glass widgets around your head. The glass is real CSS backdrop-filter, so it blurs the actual room
// behind it. The two big cards sit behind you (your head covers their edges), the follow card floats in front.

type GlassProps = { x: number; y: number; w: number; h: number; k: number; dark: boolean; r?: number; children?: React.ReactNode; style?: React.CSSProperties };
export const Glass: React.FC<GlassProps> = ({ x, y, w, h, k, dark, r = 38, children, style }) => (
  <div style={{
    position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: r, overflow: 'hidden',
    transform: `translateY(${(1 - k) * 46}px) scale(${0.72 + 0.28 * k})`, transformOrigin: '50% 60%', opacity: clamp(k * 1.6),
    background: dark ? 'linear-gradient(140deg, rgba(40,40,48,0.42), rgba(16,16,22,0.30))' : 'linear-gradient(140deg, rgba(255,255,255,0.46), rgba(255,255,255,0.16))',
    backdropFilter: 'blur(26px) saturate(170%)', WebkitBackdropFilter: 'blur(26px) saturate(170%)',
    border: `1.5px solid ${dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)'}`,
    boxShadow: `0 24px 70px rgba(0,0,0,${dark ? 0.32 : 0.16}), inset 0 1px 0 rgba(255,255,255,0.35)`,
    color: dark ? '#fff' : '#111', fontFamily: FONT.ui, ...style,
  }}>
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 38%)', pointerEvents: 'none' }} />
    {children}
  </div>
);

const numParts = (s: string) => {
  const m = s.match(/^([^\d-]*)(-?[\d.,]+)(.*)$/);
  if (!m) return { pre: '', n: 0, post: s, dec: 0 };
  const raw = m[2].replace(/,/g, '');
  return { pre: m[1], n: parseFloat(raw), post: m[3], dec: (raw.split('.')[1] || '').length };
};
export const fmt = (s: string, k: number) => {
  const p = numParts(s); const v = p.n * k;
  return `${p.pre}${p.dec ? v.toFixed(p.dec) : Math.round(v).toLocaleString('en-US')}${p.post}`;
};

const Spark: React.FC<{ size: number; color?: string }> = ({ size, color = '#D97757' }) => (
  <svg width={size} height={size} viewBox="-50 -50 100 100">
    {Array.from({ length: 10 }, (_, i) => (
      <rect key={i} x={-5} y={-46} width={10} height={40} rx={5} fill={color} transform={`rotate(${i * 36 + (i % 2) * 8})`} />
    ))}
  </svg>
);

function useWidgetTl(t: number) {
  return useTimeline(t, { a: 0, b: 0, c: 0, p: 0, n: 0, g: 0, f: 0 }, (tl, s) => {
    tl.to(s, { a: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0.0)
      .to(s, { b: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0.1)
      .to(s, { c: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0.22)
      .to(s, { p: 1, duration: 0.5, ease: 'expo.out' }, 0.32)
      .to(s, { n: 1, duration: 1.3, ease: 'power3.out' }, 0.15)
      .to(s, { g: 1, duration: 1.2, ease: 'power2.inOut' }, 0.2)
      .to(s, { f: 1, duration: 0.25, ease: 'back.out(2.5)' }, 1.0);
  });
}

const graphPts = (n: number) => Array.from({ length: n }, (_, i) => {
  const x = i / (n - 1);
  return [x, 0.12 + 0.72 * Math.pow(x, 1.6) + 0.07 * Math.sin(i * 1.9) * (1 - x)];
});

/** The two big cards, above and beside your head (behind you). */
export const GlassBehind: React.FC<{ c: FxCtx }> = ({ c }) => {
  const { t, d, W, H, face } = c;
  const s = useWidgetTl(t);
  const out = 1 - e('power2.in', t, d - 0.25, 0.25);
  const dark = str(c, 'tone', c.bright ? 'light' : 'dark') !== 'light';
  const follow = (face.x - W / 2) * 0.35;             // the widgets drift a little with you
  const bob = (i: number) => Math.sin(t * 1.7 + i * 1.3) * 7;
  const cw = W * 0.43, chh = H * 0.135, top = Math.max(H * 0.1, face.top - chh - H * 0.015);
  const pts = graphPts(16), gw = cw - 64, gh = chh * 0.48;
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * gw).toFixed(1)},${((1 - y) * gh).toFixed(1)}`).join(' ');
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <Glass x={W * 0.045 + follow} y={top + bob(0)} w={cw} h={chh} k={s.a} dark={dark}>
        <div style={{ position: 'absolute', left: 32, top: 26, fontSize: 28, fontWeight: 600, opacity: 0.72, letterSpacing: 0.3 }}>{str(c, 'label', 'Views this week')}</div>
        <div style={{ position: 'absolute', left: 30, top: 58, fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>{fmt(str(c, 'text', '197K'), s.n)}</div>
        <div style={{
          position: 'absolute', left: 32, bottom: 24, padding: '5px 14px', borderRadius: 20, fontSize: 22, fontWeight: 700,
          background: 'rgba(52,199,89,0.22)', color: dark ? '#7dff9d' : '#138a3a', transform: `scale(${s.n > 0.6 ? 1 : 0})`,
        }}>▲ {str(c, 'delta', '+38%')}</div>
      </Glass>
      <Glass x={W * 0.525 + follow} y={top + H * 0.02 + bob(1)} w={cw} h={chh} k={s.b} dark={dark}>
        <div style={{ position: 'absolute', left: 32, top: 26, fontSize: 28, fontWeight: 600, opacity: 0.72 }}>{str(c, 'graph', 'Watch time')}</div>
        <svg style={{ position: 'absolute', left: 32, bottom: 30 }} width={gw} height={gh + 6} viewBox={`0 -3 ${gw} ${gh + 6}`}>
          <defs>
            <linearGradient id="gfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34c759" stopOpacity="0.55" /><stop offset="1" stopColor="#34c759" stopOpacity="0" /></linearGradient>
            <clipPath id="gclip"><rect x={0} y={-3} width={gw * s.g} height={gh + 6} /></clipPath>
          </defs>
          <g clipPath="url(#gclip)">
            <path d={`${path} L${gw},${gh} L0,${gh} Z`} fill="url(#gfill)" />
            <path d={path} fill="none" stroke="#34c759" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </g>
          {(() => { const i = Math.min(pts.length - 1, Math.round(s.g * (pts.length - 1))); const [x, y] = pts[i];
            return <circle cx={x * gw} cy={(1 - y) * gh} r={9 * clamp(s.g * 4)} fill="#fff" stroke="#34c759" strokeWidth={4} />; })()}
        </svg>
        <div style={{ position: 'absolute', right: 30, top: 22, fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{fmt(str(c, 'hours', '4,812h'), s.g)}</div>
      </Glass>
    </div>
  );
};

/** The follow card beside your face and the "Edited by Claude" pill (in front). */
export const GlassFront: React.FC<{ c: FxCtx }> = ({ c }) => {
  const { t, d, W, H, face } = c;
  const s = useWidgetTl(t);
  const out = 1 - e('power2.in', t, d - 0.25, 0.25);
  const dark = str(c, 'tone', c.bright ? 'light' : 'dark') !== 'light';
  const fw = W * 0.36, fh = H * 0.068;
  const side = face.x > W * 0.5 ? 'left' : 'right';  // the free side of the frame
  const fx = side === 'left' ? face.x - face.w * 0.7 - fw : face.x + face.w * 0.7;
  const fy = face.y + face.w * 1.05 + Math.sin(t * 1.5 + 2) * 6;   // shoulder height, clear of the face
  const flipped = s.f > 0.5;
  const pw = W * 0.5, ph = 82;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: out }}>
      <Glass x={clamp(fx, W * 0.03, W * 0.97 - fw)} y={fy} w={fw} h={fh} k={s.c} dark={dark} r={fh / 2}>
        <div style={{ position: 'absolute', left: 12, top: 12, width: fh - 24, height: fh - 24, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.7)' }}>
          {c.cards[0] ? <Img src={staticFile(c.cards[0])} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%', transform: 'scale(1.8)' }} /> : null}
        </div>
        <div style={{ position: 'absolute', left: fh + 2, top: fh * 0.2, fontSize: 25, fontWeight: 700 }}>{str(c, 'name', 'Creator')}</div>
        <div style={{ position: 'absolute', left: fh + 2, top: fh * 0.52, fontSize: 20, fontWeight: 500, opacity: 0.65 }}>{str(c, 'handle', '@you')}</div>
        <div style={{
          position: 'absolute', right: 12, top: 12, bottom: 12, padding: '0 20px', borderRadius: 30, display: 'flex', alignItems: 'center',
          fontSize: 22, fontWeight: 700, background: flipped ? (dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)') : '#0095f6', color: flipped && !dark ? '#111' : '#fff',
          transform: `scale(${1 - 0.1 * Math.sin(clamp(s.f) * Math.PI)})`,
        }}>{flipped ? '✓ Following' : 'Follow'}</div>
      </Glass>
      <Glass x={(W - pw) / 2} y={H * 0.045} w={pw} h={ph} k={s.p} dark={dark} r={ph / 2}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontSize: 34, fontWeight: 700 }}>
          <Spark size={40} />{str(c, 'pill', 'Edited by Claude')}
        </div>
      </Glass>
    </div>
  );
};
