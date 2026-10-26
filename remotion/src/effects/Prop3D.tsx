import React, { useMemo } from 'react';
import * as THREE from 'three';
import { clamp, e, ease, faceGuard, FxCtx, FxDef, lerp, opt, str } from '../lib/core';
import { arrive, band, px, rightEdge, zones } from '../lib/layout';
import { at, camDist, cover, PixelCanvas, useFitted, useGLB, useMeshTexture } from '../lib/three';
import { exitStyle } from './reels';

// The Blender lane: a modelled prop (a GLB from `fcm blender`, scripts/blender/) placed beside your head or under your
// chin, lit by the same studio environment as the other 3D effects plus a key light from the room's side.
// It arrives from oversize (6 frames, 1.45 and -6 deg) while turning into place, sways or spins while it holds (the living
// thing) and drops out with motion blur. Named parts move: hand_hour / hand_minute sweep `hours`, a `screen` mesh shows
// `image`, a `spin` part turns about the up axis.

type Spot = { x: number; y: number; size: number; dir: number };

/** Beside the head on the side with more room; under the chin when neither side fits (or `side: chin`). */
function place(c: FxCtx, aspect: number): Spot {
  const { face, W } = c, z = zones(c);
  const want = px(c, opt(c, 'size', 320)), gap = px(c, 26), hw = face.w * 0.58 + gap;
  const y = face.y + face.w * opt(c, 'y', 0.1);
  const roomL = face.x - hw - z.margin, roomR = rightEdge(c, y - want / 2, y + want / 2) - (face.x + hw);
  const side = str(c, 'side', 'auto');
  const fitW = (room: number) => Math.min(want, room / Math.max(aspect, 0.4));
  const beside = (dir: number, room: number): Spot => {
    const size = fitW(room), w = size * aspect;
    return { x: dir < 0 ? face.x - hw - w / 2 : face.x + hw + w / 2, y: clamp(y, z.top + size / 2, z.bottom - size / 2), size, dir };
  };
  const chinSpot = (): Spot => {
    // under the chin there is more room, and a phone screen there must read: bigger unless `size` is set
    const b = band(c), size = Math.min(c.o.size === undefined ? px(c, 500) : want, b.h * 0.9, (W - 2 * z.margin) / aspect);
    return { x: face.x, y: b.top + size / 2, size, dir: 1 };
  };
  if (side === 'left') return beside(-1, roomL);
  if (side === 'right') return beside(1, roomR);
  if (side === 'chin') return chinSpot();
  const best = roomR >= roomL ? beside(1, roomR) : beside(-1, roomL);
  return best.size >= px(c, 200) ? best : chinSpot();
}

const D2R = Math.PI / 180;

const Prop: React.FC<{ c: FxCtx; layer: 'behind' | 'front' }> = ({ c, layer }) => {
  const { W, H } = c;
  const model = str(c, 'model', 'trophy');
  const scene = useGLB(/[./]/.test(model) ? model : `models/${model}.glb`);
  const fitted = useFitted(scene);
  const shot = useMeshTexture(str(c, 'image', ''));
  // the creator's screenshot on the phone's screen: unlit, so the real UI reads true
  useMemo(() => {
    const screen = fitted?.obj.getObjectByName('screen') as THREE.Mesh | undefined;
    if (!screen || !shot) return;
    const s = new THREE.Box3().setFromObject(screen).getSize(new THREE.Vector3());
    screen.material = new THREE.MeshBasicMaterial({ map: cover(shot, s.x / Math.max(s.y, 1e-6)), toneMapped: false });
  }, [fitted, shot]);
  if (!fitted || str(c, 'layer', 'front') !== layer) return null;

  const f = c.t * 30, D = c.d * 30;
  const sp = place(c, fitted.aspect);
  const a = arrive(f, 0, sp.dir, 6);
  const settle = e('expo.out', f, 0, 14);                 // turns into place a little slower than it lands
  const out = e('power2.in', f, D - 8, 8);
  const spin = opt(c, 'spin', 0);
  const yaw = (spin ? spin * c.t : opt(c, 'sway', 18) * Math.sin(c.t * 1.4)) * D2R + lerp(-40 * sp.dir, 0, settle) * D2R;
  const bob = px(c, 6) * Math.sin(c.t * 1.7);
  const s = a.k > 0 ? sp.size * lerp(1.45, 1, a.k) : 0;

  const o = fitted.obj;
  o.position.set(...at(W, H, sp.x, sp.y + bob));
  o.rotation.set(opt(c, 'tilt', 10) * D2R, yaw, lerp(-6 * sp.dir, 0, a.k) * D2R);
  o.scale.setScalar(Math.max(s, 1e-3));
  // a clock sweeps `hours` from `time` (10:10) and lands exactly on the new time
  const hm = o.getObjectByName('hand_minute'), hh = o.getObjectByName('hand_hour');
  if (hm || hh) {
    const [h0, m0] = str(c, 'time', '10:10').split(':').map(Number);
    const sweep = ease('power3.inOut')(clamp((f - 6) / Math.max(1, Math.min(D - 22, 60))));
    const mins = (h0 % 12) * 60 + (m0 || 0) + opt(c, 'hours', 3) * 60 * sweep;
    hm?.rotation.set(0, 0, -(mins % 60) / 60 * 2 * Math.PI);
    hh?.rotation.set(0, 0, -(mins / 720) * 2 * Math.PI);
  }
  o.getObjectByName('spin')?.rotation.set(0, c.t * Math.PI, 0);

  const light = str(c, 'light', 'left') === 'right' ? 1 : -1, dist = camDist(H);
  const ex = exitStyle('drop', out, c);
  const shadow = `drop-shadow(0 ${px(c, 26)}px ${px(c, 30)}px rgba(0,0,0,0.38))`;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: a.on ? a.opacity : 0, ...ex, filter: [shadow, ex.filter].filter(Boolean).join(' '),
      ...(layer === 'front' ? faceGuard(c.face) : {}) }}>
      <PixelCanvas W={W} H={H} env={opt(c, 'env', 1)}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[light * dist * 0.6, dist * 0.7, dist]} intensity={opt(c, 'key', 1.8)} />
        <primitive object={o} />
      </PixelCanvas>
    </div>
  );
};

export const MODEL_PROP: FxDef = {
  desc: 'A modelled 3D prop (Blender GLB) lands beside your head from oversize, turning into place, sways while it holds, drops out',
  options: 'model (trophy | clock | coin | phone | check | x | name in models/ | path.glb), side (auto | left | right | chin), size (320 px beside, 500 under the chin), y (0.1), layer (front | behind), spin (deg/s, 0 = sway), sway (18 deg), tilt (10 deg), light (left | right), key (1.8), env (1), hours (3, clock), time (10:10, clock), image (phone screen)',
  Behind: ({ c }) => <Prop c={c} layer="behind" />,
  Front: ({ c }) => <Prop c={c} layer="front" />,
};
