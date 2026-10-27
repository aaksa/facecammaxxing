import React from 'react';
import { AbsoluteFill, Freeze, Html5Audio, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { Cam, clamp, Face, faceAt, FxCtx, FxDef, FxSpec, layerStyle, Props, screenFace } from './lib/core';
import { EFFECTS, resolveFx } from './effects';
import { GradeFilters } from './effects/guide';

// The layer stack, back to front:
//   room    the clip (or, during a parallax move on a still camera, the clean room with you removed)
//   behind  effects you cover (giant words, the back half of a card ring, glass cards)
//   sticker an optional white outline around you
//   you     person.webm, your cut-out with alpha
//   front   effects over you (brackets, the front half of a ring, glass panels), kept off your face where needed
//   screen  flat UI that ignores the camera (vignettes, flashes, labels)
// One camera moves room, behind, you and front together; deeper layers zoom less, which gives real parallax.
// room..front form the "world"; a split effect draws the world twice with two looks, clipped at a line.

type Active = { o: FxSpec; def: FxDef; i: number };
type SlotName = 'Backdrop' | 'Behind' | 'Front' | 'Screen';

const ctxAt = (p: Props, o: FxSpec, frame: number, fps: number, W: number, H: number): FxCtx => ({
  t: frame / fps - o.start, d: Math.max(0.05, o.end - o.start), fps, W, H,
  face: faceAt(p.track, frame), o, cards: p.cards, track: p.track, bright: (p.track.bg_luma ?? 0.5) > 0.55,
});

const activeAt = (p: Props, t: number): Active[] => p.effects
  .map((o, i) => ({ o, i, def: EFFECTS[resolveFx(o.fx)] }))
  .filter((a) => a.def && t >= a.o.start && t < a.o.end);

/** Combine the camera moves at a frame: zooms multiply, the centre is weighted by how much each one zooms. */
function cameraAt(p: Props, frame: number, fps: number, W: number, H: number) {
  let zoom = 1, wsum = 0, cx = 0, cy = 0, par = 0;
  for (const a of activeAt(p, frame / fps)) {
    const cam = a.def.camera?.(ctxAt(p, a.o, frame, fps, W, H));
    if (cam && cam.zoom > 1.0001) { zoom *= cam.zoom; const w = cam.zoom - 1; cx += cam.cx * w; cy += cam.cy * w; wsum += w; par = Math.max(par, cam.parallax ?? 0); }
  }
  const cam: Cam = wsum > 0 ? { zoom: Math.min(zoom, 2), cx: cx / wsum, cy: cy / wsum } : { zoom: 1, cx: W / 2, cy: H / 2 };
  return { cam, par };
}

/** Where a world point lands on screen under a camera (main layer). */
const onScreen = (c: Cam, x: number, y: number, W: number, H: number) => {
  const z = c.zoom, x0 = clamp(c.cx - W / z / 2, 0, W - W / z), y0 = clamp(c.cy - H / z / 2, 0, H - H / z);
  return [z * (x - x0), z * (y - y0)];
};

/** Renders one slot of one effect with its own clock, so motion blur can sample it between frames. */
const Slot: React.FC<{ p: Props; a: Active; slot: SlotName; map?: (f: Face) => Face }> = ({ p, a, slot, map }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const Comp = a.def[slot]!;
  const c = ctxAt(p, a.o, frame, fps, W, H);
  return <AbsoluteFill><Comp c={map ? { ...c, face: map(c.face) } : c} /></AbsoluteFill>;
};

const Layer: React.FC<{ p: Props; a: Active; slot: SlotName; style?: React.CSSProperties; map?: (f: Face) => Face }> =
  ({ p, a, slot, style, map }) => (
    <AbsoluteFill style={style}>
      {a.def.blur && (slot === 'Behind' || slot === 'Front')
        ? <CameraMotionBlur samples={a.def.blur} shutterAngle={200}><Slot p={p} a={a} slot={slot} map={map} /></CameraMotionBlur>
        : <Slot p={p} a={a} slot={slot} map={map} />}
    </AbsoluteFill>
  );

type Look = {
  cam: Cam; par: number; clean: boolean; face: Face; freeze: number | null;
  rf: string; pf: string; sticker: number; pscale: number; dof: number;
  card: { T: React.CSSProperties; room: string; you: string } | null;   // the shot shrunk into a card (you may break out of its top)
};

/** room + behind + sticker + you + front, under one camera. */
const World: React.FC<{ p: Props; L: Look; active: Active[]; id: string; style?: React.CSSProperties }> = ({ p, L, active, id, style }) => {
  const { width: W, height: H } = useVideoConfig();
  const { cam, par, face } = L;
  const z = cam.zoom;
  const roomZ = Math.pow(z, 1 - 0.5 * par), behindZ = Math.pow(z, 1 - 0.22 * par);
  const T = (zl: number) => layerStyle(cam, zl, W, H, face);
  const held = (f: Face) => (L.freeze !== null ? face : f);           // a frozen shot keeps the frozen face
  const toScreen = (f: Face) => screenFace(cam, held(f), W, H);
  // a blurred room shows its soft edges; scale it a touch so they stay outside the frame
  const roomBlur = L.rf.match(/blur\(([\d.]+)px\)/g)?.reduce((m, b) => Math.max(m, parseFloat(b.slice(5))), 0) ?? 0;
  const roomPad = 1 + (roomBlur * 3) / W;
  const vid: React.CSSProperties = { width: W, height: H, position: 'absolute', left: 0, top: 0 };
  // depth of field: the behind layer sits just behind you, so it goes a little less soft than the room
  const bf: React.CSSProperties = L.dof > 0.2 ? { filter: `blur(${(L.dof * 0.7).toFixed(2)}px)` } : {};
  const hold = (el: React.ReactNode) => (L.freeze !== null ? <Freeze frame={L.freeze}>{el}</Freeze> : el);
  const body: React.CSSProperties = L.pscale !== 1
    ? { transform: `scale(${L.pscale})`, transformOrigin: `${face.x}px ${face.y + face.w * 1.6}px` } : {};
  // inside a card: the room is clipped to the card, you only to its sides and bottom, so your head can pop out over the top
  const inCard = (clip: string, el: React.ReactNode) => (L.card
    ? <AbsoluteFill style={{ clipPath: clip }}><AbsoluteFill style={L.card.T}>{el}</AbsoluteFill></AbsoluteFill> : <>{el}</>);
  return (
    <AbsoluteFill style={style}>
      {inCard(L.card?.room ?? '', <>
      <AbsoluteFill style={T(roomZ)}>
        {hold(<OffthreadVideo muted src={staticFile(L.clean ? 'room.mp4' : 'source.mp4')}
          style={{ ...vid, filter: L.rf || undefined, transform: roomPad > 1 ? `scale(${roomPad})` : undefined }} />)}
      </AbsoluteFill>
      {active.filter((a) => a.def.Behind).map((a) => a.def.depth === 'screen'
        ? <Layer key={`b${a.i}`} p={p} a={a} slot="Behind" style={bf} map={toScreen} />
        : <Layer key={`b${a.i}`} p={p} a={a} slot="Behind" style={{ ...T(a.def.depth === 'room' ? roomZ : behindZ), ...bf }} map={held} />)}
      </>)}
      {inCard(L.card?.you ?? '', <>
      {active.length ? (
        <AbsoluteFill style={T(z)}>
          <AbsoluteFill style={body}>
            {L.sticker > 0.2 ? (
              <>
                <svg width="0" height="0" style={{ position: 'absolute' }}>
                  <filter id={`stk-${id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
                    <feComponentTransfer in="SourceAlpha" result="a"><feFuncA type="linear" slope="3" intercept="-1" /></feComponentTransfer>
                    <feMorphology in="a" operator="dilate" radius={L.sticker} result="d" />
                    <feGaussianBlur in="d" stdDeviation="0.8" result="ds" />
                    <feFlood floodColor="#ffffff" result="w" />
                    <feComposite in="w" in2="ds" operator="in" result="outline" />
                    <feDropShadow in="outline" dx="0" dy="14" stdDeviation="16" floodColor="#000" floodOpacity="0.4" />
                  </filter>
                </svg>
                {hold(<OffthreadVideo muted transparent src={staticFile('person.webm')} style={{ ...vid, filter: `url(#stk-${id})` }} />)}
              </>
            ) : null}
            {hold(<OffthreadVideo muted transparent src={staticFile('person.webm')} style={{ ...vid, filter: L.pf || undefined }} />)}
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}
      {active.filter((a) => a.def.Front).map((a) => a.def.frontDepth === 'screen'
        ? <Layer key={`f${a.i}`} p={p} a={a} slot="Front" map={toScreen} />
        : <Layer key={`f${a.i}`} p={p} a={a} slot="Front" style={T(z)} map={held} />)}
      </>)}
    </AbsoluteFill>
  );
};

export const Stage: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const active = activeAt(p, t);

  const rf: string[] = [], pf: string[] = [], wf: string[] = [];
  let freeze: number | null = null, sticker = 0, pscale = 1, blurCam = false, dof = 0;
  let split: { x: number; left: string; right: string } | null = null;
  let card: ReturnType<NonNullable<FxDef['card']>> = null;
  for (const a of active) {
    const c = ctxAt(p, a.o, frame, fps, W, H);
    const r = a.def.room?.(c); if (r) rf.push(r);
    const q = a.def.person?.(c); if (q) pf.push(q);
    const g = a.def.world?.(c); if (g) wf.push(g);
    const fz = a.def.freeze?.(c); if (fz !== null && fz !== undefined) freeze = Math.round((a.o.start + fz) * fps);
    sticker = Math.max(sticker, a.def.sticker?.(c) ?? 0);
    pscale *= a.def.personScale?.(c) ?? 1;
    split = a.def.split?.(c) ?? split;
    card = a.def.card?.(c) ?? card;
    blurCam = blurCam || !!a.def.cameraBlur;
    dof += a.def.dof?.(c) ?? 0;
  }
  if (dof > 0.2) rf.push(`blur(${dof.toFixed(2)}px)`);
  const { cam, par: par0 } = cameraAt(p, frame, fps, W, H);
  const clean = p.hasRoom && p.track.static && par0 > 0.001;   // parallax needs the room without you in it
  const face = faceAt(p.track, freeze ?? frame);
  let cardLook: Look['card'] = null;
  if (card && card.k > 0.0005) {
    const { k } = card, sc = 1 + (card.s - 1) * k;
    const x0 = card.x * k, x1 = W - (W - card.x - card.w) * k, y0 = card.y * k, r = card.r * k;
    cardLook = {
      T: { transform: `translate(${card.dx * k}px, ${card.dy * k}px) scale(${sc})`, transformOrigin: '0 0' },
      room: `inset(${y0}px ${W - x1}px 0 ${x0}px round ${r}px ${r}px 0 0)`,
      you: `polygon(${x0}px -${H}px, ${x1}px -${H}px, ${x1}px ${H * 2}px, ${x0}px ${H * 2}px)`,
    };
  }
  const L: Look = { cam, par: clean ? par0 : 0, clean, face, freeze, rf: rf.join(' '), pf: pf.join(' '), sticker, pscale, dof, card: cardLook };

  // camera motion blur: how far the shot's centre and corners move between neighbouring frames
  let mb = '', mbPad = 1;
  if (blurCam) {
    const a = cameraAt(p, frame - 1, fps, W, H).cam, b = cameraAt(p, frame + 1, fps, W, H).cam;
    const z = cam.zoom, x0 = clamp(cam.cx - W / z / 2, 0, W - W / z), y0 = clamp(cam.cy - H / z / 2, 0, H - H / z);
    // measured where the eye is (your face and the frame centre), not the corners: a zoom's corner speed would smear the face
    let sx = 0, sy = 0;
    for (const [wx, wy] of [[face.x, face.y], [x0 + W / z / 2, y0 + H / z / 2]]) {
      const [ax, ay] = onScreen(a, wx, wy, W, H), [bx, by] = onScreen(b, wx, wy, W, H);
      sx = Math.max(sx, Math.abs(bx - ax) / 2); sy = Math.max(sy, Math.abs(by - ay) / 2);
    }
    // a 180-degree shutter smears half a frame of travel; a gaussian of sigma ~0.3 x that length matches it
    sx = Math.min(14, sx * 0.15); sy = Math.min(14, sy * 0.15);
    if (sx + sy > 0.4) { mb = `${sx.toFixed(2)} ${sy.toFixed(2)}`; mbPad = 1 + (3 * Math.max(sx, sy)) / Math.min(W, H); }
  }
  // Chrome blurs transparent pixels in at the frame edge; grow the shot by ~3 sigma while it blurs so no dark rim shows
  const pad: React.CSSProperties = mbPad > 1 ? { transform: `scale(${mbPad})`, transformOrigin: '50% 50%' } : {};
  const worldFilter = [mb ? 'url(#fcm-mb)' : '', ...wf].filter(Boolean).join(' ');

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {p.track.audio && !p.silent ? <Html5Audio src={staticFile('source.mp4')} /> : null}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        {mb ? <filter id="fcm-mb" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation={mb} edgeMode="duplicate" /></filter> : null}
        <GradeFilters />
      </svg>
      {active.filter((a) => a.def.Backdrop).map((a) => <Layer key={`d${a.i}`} p={p} a={a} slot="Backdrop" />)}
      {split ? (
        <>
          {split.x < W ? <World p={p} L={L} active={active} id="r" style={{ ...pad, filter: [split.right, worldFilter].filter(Boolean).join(' ') || undefined }} /> : null}
          {split.x > 0 ? <World p={p} L={L} active={active} id="l" style={{ ...pad, filter: [split.left, worldFilter].filter(Boolean).join(' ') || undefined, clipPath: split.x < W ? `inset(0 ${W - split.x}px 0 0)` : undefined }} /> : null}
        </>
      ) : (
        <World p={p} L={L} active={active} id="w" style={worldFilter ? { ...pad, filter: worldFilter } : undefined} />
      )}
      {active.filter((a) => a.def.Screen).map((a) => <Layer key={`s${a.i}`} p={p} a={a} slot="Screen" />)}
    </AbsoluteFill>
  );
};
