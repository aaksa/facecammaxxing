import React, { useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import * as THREE from 'three';
import { clamp, e, ease, faceGuard, FxCtx, list, opt, str } from '../lib/core';
import { gloss, roundedPlane, useCardTextures } from '../lib/assets';

// A real 3D ring of reel cards around your head. The same scene is drawn twice: the back half before you
// (so you cover it) and the front half after you (kept off your face). The camera is set up so that the
// z = 0 plane maps 1:1 onto the frame's pixels, so the ring is placed in plain frame coordinates.

const FOV = 30;
export type RingMode = 'carousel' | 'orbit';
type Card = { x: number; y: number; z: number; yaw: number; s: number; a: number; shade: number; glint: number; i: number };

function layout(c: FxCtx, mode: RingMode, K: number): { cards: Card[]; tilt: number; cx: number; cy: number } {
  const { t, d, W, face } = c;
  const intro = e('expo.out', t, 0, 0.55), out = 1 - e('power2.in', t, d - 0.28, 0.28);
  const carousel = mode === 'carousel';
  const R = W * opt(c, 'radius', carousel ? 0.42 : 0.4) * (0.35 + 0.65 * intro);
  // orbit is steep: the back arc passes behind your head, the front arc across your chest
  const tilt = opt(c, 'tilt', carousel ? 16 : 48) * Math.PI / 180;
  const cx = face.x, cy = face.y + face.w * (carousel ? 0.85 : 0.3);   // carousel: the front cards pass under your chin
  // carousel: spins up fast and settles; orbit: a steady turn
  const turns = opt(c, 'turns', 1.25);
  const base = carousel
    ? -turns * 2 * Math.PI * (1 - ease('power3.out')(clamp(t / Math.max(0.6, d * 0.9)))) + t * 0.12
    : t * opt(c, 'speed', 1.6);
  const cards: Card[] = [];
  for (let i = 0; i < K; i++) {
    const th = base + (i * 2 * Math.PI) / K;
    const sx = Math.sin(th), cz = Math.cos(th);
    const pop = ease('back.out(1.6)')(clamp((t - i * 0.035) / 0.42));
    cards.push({
      x: cx + R * sx, y: cy + R * cz * Math.sin(tilt), z: R * cz * Math.cos(tilt),
      yaw: -0.5 * sx, s: pop, a: out * clamp(t / 0.12),
      shade: 0.5 + 0.5 * (cz + 1) / 2, glint: Math.pow(Math.max(0, Math.sin(th + 0.9)), 6), i,
    });
  }
  return { cards, tilt, cx, cy };
}

const CardMesh: React.FC<{ card: Card; tex: THREE.Texture; W: number; H: number; geo: THREE.ShapeGeometry; rim: THREE.ShapeGeometry }> =
  ({ card, tex, W, H, geo, rim }) => (
    <group position={[card.x - W / 2, H / 2 - card.y, card.z]} rotation={[0, card.yaw, 0]} scale={card.s}>
      <mesh geometry={rim} position={[0, 0, -0.6]}>
        <meshBasicMaterial color="#0d0d10" transparent opacity={card.a * 0.96} />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial map={tex} color={new THREE.Color(card.shade, card.shade, card.shade)} transparent opacity={card.a} />
      </mesh>
      <mesh geometry={geo} position={[0, 0, 0.4]}>
        <meshBasicMaterial map={gloss()} transparent opacity={card.a * (0.08 + 0.5 * card.glint)} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );

export const CardRing: React.FC<{ c: FxCtx; side: 'back' | 'front'; mode: RingMode }> = ({ c, side, mode }) => {
  const { W, H } = c;
  const imgs = list(c, 'images', []).length ? list(c, 'images', []) : c.cards;
  const K = Math.round(opt(c, 'count', mode === 'carousel' ? 9 : 7));
  const srcs = useMemo(() => Array.from({ length: K }, (_, i) => imgs[i % Math.max(1, imgs.length)]), [K, imgs.join('|')]);
  const tex = useCardTextures(srcs, str(c, 'ui', imgs === c.cards ? '1' : '0') !== '0');
  const cw = W * opt(c, 'size', mode === 'carousel' ? 0.2 : 0.19), ch = (cw * 16) / 9;
  const geo = useMemo(() => roundedPlane(cw, ch, cw * 0.09), [cw, ch]);
  const rim = useMemo(() => roundedPlane(cw * 1.035, ch * 1.02, cw * 0.1), [cw, ch]);
  if (!tex) return null;
  const { cards } = layout(c, mode, K);
  const mine = cards.filter((k) => (side === 'front' ? k.z > 0 : k.z <= 0)).sort((a, b) => a.z - b.z);
  const dist = H / 2 / Math.tan((FOV * Math.PI) / 360);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      // depth of field: the far half is softer and a little darker
      filter: side === 'back' ? `blur(${opt(c, 'dof', 2.2)}px)` : undefined,
      ...(side === 'front' ? faceGuard(c.face) : {}),
    }}>
      <ThreeCanvas width={W} height={H} flat linear={false} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ fov: FOV, position: [0, 0, dist], near: 10, far: dist * 4 }} style={{ position: 'absolute', inset: 0 }}>
        {mine.map((k) => <CardMesh key={k.i} card={k} tex={tex[k.i % tex.length]} W={W} H={H} geo={geo} rim={rim} />)}
      </ThreeCanvas>
    </div>
  );
};
