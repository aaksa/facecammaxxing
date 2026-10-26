import React from 'react';
import { AbsoluteFill } from 'remotion';
import { clamp, e, FxCtx, FxDef, lerp, opt, str, useTimeline } from '../lib/core';
import { FONT, FontKey } from '../lib/fonts';
import { useFitSize } from '../lib/assets';
import { CardRing } from './CardRing';
import { GlassBehind, GlassFront } from './GlassWidgets';
import { GLASS_GRAPH, GUIDE } from './guide';
import { MODEL_PROP } from './Prop3D';
import { BOTTOM_FADE, KINETIC_CAPTION, NAME_TAG, SILHOUETTE_INTRO, WINDOW_CARDS } from './reels';

// Every effect is a pure function of its own clock (c.t from 0 to c.d seconds) and the tracked face.
// Envelope: most effects come in over the first ~0.3 s and leave over the last ~0.25 s.
const env = (c: FxCtx, tin = 0.3, tout = 0.25, inEase = 'expo.out', outEase = 'power2.inOut') =>
  e(inEase, c.t, 0, tin) * (1 - e(outEase, c.t, c.d - tout, tout));

/** Keep the face at `headAt` of the frame height while zoomed. */
const faceCam = (c: FxCtx, zoom: number, headAt = 0.4, parallax = 0) =>
  ({ zoom, cx: c.face.x, cy: c.face.y + (c.H / zoom) * (0.5 - headAt), parallax });

/** The punch-in's envelope: snaps in over `in` frames, holds, snaps back out over `out` frames (frames at 30 fps). */
const punchK = (c: FxCtx) => {
  const i = opt(c, 'in', 5) / 30, o = opt(c, 'out', 6) / 30;
  return e('expo.out', c.t, 0, i) * (1 - e('power2.in', c.t, c.d - o, o));
};

const ink = (c: FxCtx, light = '#f4e9d8', dark = '#141418') => str(c, 'color', c.bright ? dark : light);

// ---------- locked-on ----------
const LockedOn: React.FC<{ c: FxCtx }> = ({ c }) => {
  const { face, W } = c;
  const s = useTimeline(c.t, { k: 0, a: 0, tag: 0, scan: 0 }, (tl, s) => {
    tl.fromTo(s, { k: 0 }, { k: 1, duration: 0.42, ease: 'expo.out' }, 0)
      .fromTo(s, { a: 0 }, { a: 1, duration: 0.1, ease: 'none' }, 0)
      .fromTo(s, { tag: 0 }, { tag: 1, duration: 0.35, ease: 'power3.out' }, 0.3)
      .fromTo(s, { scan: 0 }, { scan: 1, duration: 0.7, ease: 'sine.inOut', repeat: -1, yoyo: true }, 0.4);
  });
  const out = 1 - e('power2.in', c.t, c.d - 0.18, 0.18);
  const grow = lerp(2.3, 1, s.k) * (1 + 0.012 * Math.sin(c.t * 9));
  const bw = face.w * 1.45 * grow, bh = face.w * 1.85 * grow, cx = face.x, cy = face.y - face.w * 0.08;
  const L = Math.min(bw, bh) * 0.2, sw = 7;
  const x0 = cx - bw / 2, y0 = cy - bh / 2, x1 = cx + bw / 2, y1 = cy + bh / 2;
  const red = str(c, 'color', '#ff2d3d');
  const corner = (x: number, y: number, dx: number, dy: number) => `M${x},${y + dy * L} L${x},${y} L${x + dx * L},${y}`;
  return (
    <AbsoluteFill style={{ opacity: s.a * out }}>
      <svg width={W} height={c.H} style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.45))' }}>
        <path d={[corner(x0, y0, 1, 1), corner(x1, y0, -1, 1), corner(x0, y1, 1, -1), corner(x1, y1, -1, -1)].join(' ')}
          fill="none" stroke="#fff" strokeWidth={sw} strokeLinecap="square" />
        {[[cx, y0 - 14, cx, y0 + 18], [cx, y1 - 18, cx, y1 + 14], [x0 - 14, cy, x0 + 18, cy], [x1 - 18, cy, x1 + 14, cy]].map(([a, b, cc, dd], i) =>
          <line key={i} x1={a} y1={b} x2={cc} y2={dd} stroke={red} strokeWidth={4} />)}
        <line x1={x0 + 10} x2={x1 - 10} y1={lerp(y0 + 10, y1 - 10, s.scan)} y2={lerp(y0 + 10, y1 - 10, s.scan)} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
      </svg>
      <div style={{
        position: 'absolute', left: x0, top: y1 + 18, padding: '8px 16px', background: red, color: '#fff', fontFamily: FONT.mono, fontWeight: 700,
        fontSize: 30, letterSpacing: 2, clipPath: `inset(0 ${(1 - s.tag) * 100}% 0 0)`,
      }}>{str(c, 'text', 'LOCKED ON')}</div>
      <div style={{ position: 'absolute', left: x1 - 220, top: y0 - 46, width: 220, textAlign: 'right', color: '#fff', fontFamily: FONT.mono, fontSize: 22, opacity: s.tag, textShadow: '0 0 8px rgba(0,0,0,0.6)' }}>
        X {(face.x / W).toFixed(3)} Y {(face.y / c.H).toFixed(3)}
      </div>
    </AbsoluteFill>
  );
};

// ---------- spotlight ----------
const SpotBehind: React.FC<{ c: FxCtx }> = ({ c }) => {
  const k = spotK(c), { face, W, H } = c;
  const text = str(c, 'text', '');
  const size = useFitSize(text || 'X', FONT.anton, W * 0.9);
  const col = str(c, 'color', '#ffe2b8');
  const word = useTimeline(c.t, { w: 0 }, (tl, s) => { tl.fromTo(s, { w: 0 }, { w: 1, duration: 0.6, ease: 'power2.out' }, 0.25); });
  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: k,
        background: `radial-gradient(ellipse ${W * 0.62}px ${H * 0.34}px at ${face.x}px ${face.y - face.w * 0.15}px, rgba(255,226,190,0.55), rgba(255,200,150,0.12) 55%, rgba(0,0,0,0) 100%)`,
      }} />
      {text && size ? (
        <div style={{
          position: 'absolute', left: 0, width: W, top: face.y - face.w * 0.35 - size * 0.62, textAlign: 'center',
          fontFamily: FONT.anton, fontSize: size, lineHeight: 1, color: col, opacity: k * word.w,
          letterSpacing: lerp(30, 0, word.w), textShadow: `0 0 18px ${col}, 0 0 60px ${col}aa, 0 0 140px ${col}66`,
          filter: `blur(${(1 - word.w) * 6}px)`,
        }}>{text}</div>
      ) : null}
    </AbsoluteFill>
  );
};
function spotK(c: FxCtx) {
  // the lights cut with a short flicker, like a breaker, and come back at the end
  const t = c.t;
  const flick = t < 0.05 ? t / 0.05 * 0.9 : t < 0.1 ? 0.35 : t < 0.16 ? 0.8 : t < 0.2 ? 0.55 : 1;
  return flick * (1 - e('power2.inOut', t, c.d - 0.3, 0.3));
}

// ---------- backdrop-word ----------
const BackdropWord: React.FC<{ c: FxCtx }> = ({ c }) => {
  const { W, face } = c;
  const text = str(c, 'text', 'CLAUDE').toUpperCase();
  const fk = (str(c, 'font', 'anton') as FontKey) in FONT ? (str(c, 'font', 'anton') as FontKey) : 'anton';
  const size = useFitSize(text, FONT[fk], W * opt(c, 'width', 0.94));
  const letters = [...text];
  const s = useTimeline(c.t, Object.fromEntries(letters.map((_, i) => [`l${i}`, 0])) as Record<string, number>, (tl, s) => {
    letters.forEach((_, i) => tl.fromTo(s, { [`l${i}`]: 0 }, { [`l${i}`]: 1, duration: 0.62, ease: 'back.out(1.7)' }, 0.05 + i * 0.055));
  }, [text]);
  if (!size) return null;
  const out = e('power2.in', c.t, c.d - 0.24, 0.24);
  const col = ink(c);
  const base = face.y - face.w * opt(c, 'y', 0.12);          // the word's baseline sits around your eyes, so your head covers it
  return (
    <div style={{ position: 'absolute', left: 0, width: W, top: base - size * 0.92, height: size * 1.1, display: 'flex', justifyContent: 'center',
      fontFamily: FONT[fk], fontSize: size, lineHeight: 1, color: col, opacity: 1 - out }}>
      {letters.map((ch, i) => {
        const k = s[`l${i}`];
        const r = ((i * 7919) % 11) / 10 - 0.5;
        return (
          <span key={i} style={{
            display: 'inline-block', whiteSpace: 'pre',
            transform: `translateY(${(1 - k) * -c.H * 0.55 + out * c.H * 0.12}px) rotate(${(1 - k) * r * 30}deg) scaleY(${1 + (1 - clamp(k * 1.2)) * 0.25})`,
            opacity: clamp(k * 3), textShadow: c.bright ? '0 18px 50px rgba(0,0,0,0.18)' : '0 18px 50px rgba(0,0,0,0.45)',
          }}>{ch}</span>
        );
      })}
    </div>
  );
};

// ---------- grade ----------
type Fn = [string, number, string, number];   // css function, value at full strength, unit, identity
const GRADES: Record<string, Fn[]> = {
  moody: [['contrast', 1.14, '', 1], ['saturate', 0.72, '', 1], ['brightness', 0.9, '', 1], ['sepia', 0.12, '', 0]],
  bw: [['grayscale', 1, '', 0], ['contrast', 1.18, '', 1], ['brightness', 0.96, '', 1]],
  warm: [['sepia', 0.22, '', 0], ['saturate', 1.18, '', 1], ['hue-rotate', -6, 'deg', 0], ['brightness', 1.02, '', 1]],
  cool: [['saturate', 0.88, '', 1], ['hue-rotate', 10, 'deg', 0], ['contrast', 1.06, '', 1], ['brightness', 0.97, '', 1]],
  pop: [['saturate', 1.4, '', 1], ['contrast', 1.12, '', 1]],
};
const gradeCss = (name: string, k: number) => (GRADES[name] || GRADES.moody).map(([f, v, u, id]) => `${f}(${lerp(id, v, k)}${u})`).join(' ');
const Vignette: React.FC<{ k: number; amt?: number }> = ({ k, amt = 0.55 }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 62% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,${amt * k}) 100%)` }} />
);

// ---------- the registry ----------
// One library, every effect equal; the order here is only the order `fcm list` prints.
export const EFFECTS: Record<string, FxDef> = {
  ...GUIDE,
  'glass-graph': GLASS_GRAPH,
  'locked-on': {
    desc: 'Corner brackets snap onto your face and the camera follows you',
    options: 'zoom (1.3), text (tag, LOCKED ON), color',
    camera: (c) => faceCam(c, 1 + (opt(c, 'zoom', 1.3) - 1) * env(c, 0.35, 0.25), 0.42, 0.5 * env(c, 0.35, 0.25)),
    Front: LockedOn,
  },
  'lean-in': {
    desc: 'A hard punch-in on one word: snaps in over 5 frames with motion blur while the room and the words behind you go soft, drifts in while it holds, snaps back out',
    options: 'zoom (1.3, max 2), parallax (0.6), dof (8 px), in (5 frames), out (6 frames)',
    camera: (c) => {
      const k = punchK(c), drift = 0.025 * e('sine.inOut', c.t, 0, c.d);   // the hold keeps creeping in
      return faceCam(c, 1 + ((opt(c, 'zoom', 1.3) - 1) + drift) * k, 0.4, opt(c, 'parallax', 0.6) * k);
    },
    cameraBlur: true,
    dof: (c) => opt(c, 'dof', 8) * (c.W / 1080) * punchK(c),
  },
  'slow-push': {
    desc: 'A slow cinematic push-in while the room melts out of focus (real parallax on a still camera)',
    options: 'zoom (1.5), blur (10 px), parallax (1)',
    camera: (c) => { const k = e('sine.inOut', c.t, 0, c.d); return faceCam(c, 1 + (opt(c, 'zoom', 1.5) - 1) * k, 0.42, opt(c, 'parallax', 1) * Math.min(1, k * 4)); },
    room: (c) => `blur(${opt(c, 'blur', 10) * e('sine.inOut', c.t, 0, c.d)}px)`,
    Screen: ({ c }) => <Vignette k={e('sine.inOut', c.t, 0, c.d)} amt={0.4} />,
  },
  spotlight: {
    desc: 'Kills the lights, keeps you lit with a warm rim, optional glowing word behind you',
    options: 'text (glowing word), color, push (1.06)',
    camera: (c) => faceCam(c, 1 + (opt(c, 'push', 1.06) - 1) * e('sine.inOut', c.t, 0, c.d), 0.42, 0.4),
    room: (c) => { const k = spotK(c); return `brightness(${lerp(1, 0.16, k)}) saturate(${lerp(1, 0.55, k)}) contrast(${lerp(1, 1.1, k)})`; },
    person: (c) => { const k = spotK(c); return `brightness(${lerp(1, 1.06, k)}) drop-shadow(0 0 ${lerp(0, 26, k)}px rgba(255,214,170,${0.55 * k}))`; },
    Behind: SpotBehind,
    Screen: ({ c }) => <Vignette k={spotK(c)} amt={0.6} />,
  },
  'backdrop-word': {
    desc: 'A giant word drops in behind you, letter by letter, with motion blur',
    options: 'text (CLAUDE), color, font (anton | bold | serif), width (0.94), y (0.12)',
    Behind: BackdropWord,
    blur: 14,
    depth: 'screen',   // stays whole and still while the camera punches in on you
  },
  'carousel-spin': {
    desc: 'Your reels spin around you in a real 3D carousel, then settle',
    options: 'images (folder), count (9), size (0.2), radius (0.42), tilt (16), turns (1.25), dof (2.2)',
    Behind: ({ c }) => <CardRing c={c} side="back" mode="carousel" />,
    Front: ({ c }) => <CardRing c={c} side="front" mode="carousel" />,
  },
  orbit: {
    desc: 'Your reels orbit your head in 3D: behind you at the top, in front at the bottom',
    options: 'images (folder), count (7), size (0.19), speed (1.6), tilt (48)',
    Behind: ({ c }) => <CardRing c={c} side="back" mode="orbit" />,
    Front: ({ c }) => <CardRing c={c} side="front" mode="orbit" />,
  },
  'glass-widgets': {
    desc: 'Frosted glass widgets around your head: a counting stat, a climbing graph, a follow card, an Edited by Claude pill',
    options: 'text (197K), label, delta, graph, hours, name, handle, pill, tone (dark | light)',
    Behind: GlassBehind,
    Front: GlassFront,
  },
  'kinetic-caption': KINETIC_CAPTION,
  'window-cards': WINDOW_CARDS,
  'name-tag': NAME_TAG,
  'silhouette-intro': SILHOUETTE_INTRO,
  'bottom-fade': BOTTOM_FADE,
  'prop-3d': MODEL_PROP,
  grade: {
    desc: 'A colour grade on the room and you',
    options: 'grade (moody | bw | warm | cool | pop)',
    world: (c) => gradeCss(str(c, 'grade', 'moody'), env(c, 0.2, 0.2, 'power2.out')),
    Screen: ({ c }) => <Vignette k={env(c, 0.2, 0.2, 'power2.out')} amt={str(c, 'grade', 'moody') === 'pop' ? 0.2 : 0.45} />,
  },
};

export const ALIASES: Record<string, string> = {
  locked: 'locked-on', lock: 'locked-on', 'lock-on': 'locked-on', punch: 'lean-in', 'punch-in': 'lean-in', push: 'slow-push', 'push-in': 'slow-push',
  spot: 'spotlight', lights: 'spotlight', backdrop: 'backdrop-word', word: 'backdrop-word', carousel: 'carousel-spin', spin: 'carousel-spin',
  glass: 'glass-widgets', widgets: 'glass-widgets', moody: 'grade',
  caption: 'kinetic-caption', captions: 'kinetic-caption', kinetic: 'kinetic-caption', windows: 'window-cards', window: 'window-cards', 'retro-windows': 'window-cards',
  nametag: 'name-tag', 'lower-third': 'name-tag', lowerthird: 'name-tag', silhouette: 'silhouette-intro', 'bottom-gradient': 'bottom-fade', fade: 'bottom-fade',
  shoulder: 'over-the-shoulder', ots: 'over-the-shoulder', overtheshoulder: 'over-the-shoulder', graph: 'glass-graph', glassgraph: 'glass-graph', kallaway: 'kallaway-split', 'kallaway-chart': 'kallaway-split', 'split-chart': 'kallaway-split', 'bar-chart': 'kallaway-split', chart: 'kallaway-split',
  prop: 'prop-3d', model: 'prop-3d', '3d': 'prop-3d', trophy: 'prop-3d', blender: 'prop-3d',
  freeze: 'freeze-frame', freezeframe: 'freeze-frame', sticker: 'freeze-frame', tiers: 'tier-list', tier: 'tier-list', tierlist: 'tier-list',
  'text-behind-head': 'text-behind', textbehind: 'text-behind', 'colour-grade': 'color-grade', colorgrade: 'color-grade', 'before-after': 'color-grade', wipe: 'color-grade',
};
export const resolveFx = (name: string) => { const n = name.toLowerCase().replace(/^\//, ''); return ALIASES[n] ?? n; };
