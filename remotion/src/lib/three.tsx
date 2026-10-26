import React, { useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cardSrc, useAsync } from './assets';
import { fontsReady } from './fonts';

// The Three.js lane. Every 3D effect draws into a PixelCanvas: a frame-sized canvas whose z = 0 plane maps 1:1 onto the
// frame's pixels, so objects are placed in plain frame coordinates (at(x, y)) next to the tracked face, and a 3D object
// at z = 0 lines up exactly with the HTML layers around it. Motion comes from GSAP timelines seeked per frame (useTimeline),
// never from useFrame or a clock, so any frame renders the same on its own.

export const FOV = 30;
/** Camera distance that makes the z = 0 plane exactly H pixels tall. */
export const camDist = (H: number) => H / 2 / Math.tan((FOV * Math.PI) / 360);
/** Frame pixels (x right, y down) to world coordinates (y up, origin at the centre). */
export const at = (W: number, H: number, x: number, y: number, z = 0): [number, number, number] => [x - W / 2, H / 2 - y, z];

/** Studio light from an environment map (soft reflections on clearcoat and glass), plus localClippingEnabled when asked. */
const Setup: React.FC<{ env: number; clipping: boolean }> = ({ env, clipping }) => {
  const { gl, scene } = useThree();
  useMemo(() => {
    if (env <= 0) return;
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }, [gl, scene, env > 0]);
  scene.environmentIntensity = env;
  gl.localClippingEnabled = clipping;
  return null;
};

export const PixelCanvas: React.FC<{ W: number; H: number; env?: number; clipping?: boolean; style?: React.CSSProperties; children: React.ReactNode }> =
  ({ W, H, env = 1, clipping = false, style, children }) => {
    const dist = camDist(H);
    return (
      <ThreeCanvas width={W} height={H} flat linear={false} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ fov: FOV, position: [0, 0, dist], near: 10, far: dist * 4 }} style={{ position: 'absolute', inset: 0, ...style }}>
        <Setup env={env} clipping={clipping} />
        {children}
      </ThreeCanvas>
    );
  };

// ---------- geometry ----------
const boxCache = new Map<string, THREE.BufferGeometry>();
/** A rounded box (cached by size): tiles, slabs, chips, plates. */
export function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const key = [w, h, d, r].map((v) => v.toFixed(1)).join(':');
  let g = boxCache.get(key);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)); boxCache.set(key, g); }
  return g;
}

// ---------- textures drawn on a 2D canvas (text, labels, logos) ----------
export type Painted = { tex: THREE.CanvasTexture; w: number; h: number };   // w / h: the canvas size in CSS px (before `res`)
/** Canvas textures made once (after the fonts load) and shared by every frame. Each maker draws one canvas. */
export function usePainted(key: string, makers: (() => Promise<HTMLCanvasElement> | HTMLCanvasElement)[], res = 2): Painted[] | null {
  return useAsync(`paint:${res}:${key}`, async () => {
    await fontsReady; await document.fonts.ready;
    const out: Painted[] = [];
    for (const make of makers) {
      const cv = await make();
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
      out.push({ tex: t, w: cv.width / res, h: cv.height / res });
    }
    return out;
  });
}

/** A canvas sized to a line of text: `font` is a CSS font at CSS px, drawn at `res` x for crisp edges. */
export function textCanvas(text: string, font: string, color: string, padX = 0, padY = 0, res = 2, extra?: (g: CanvasRenderingContext2D, w: number, h: number) => void): HTMLCanvasElement {
  const m = document.createElement('canvas').getContext('2d')!; m.font = font;
  const mt = m.measureText(text);
  const asc = mt.actualBoundingBoxAscent, desc = mt.actualBoundingBoxDescent;
  const w = Math.ceil(mt.width + padX * 2), h = Math.ceil(asc + desc + padY * 2);
  const cv = document.createElement('canvas'); cv.width = w * res; cv.height = h * res;
  const g = cv.getContext('2d')!; g.scale(res, res);
  extra?.(g, w, h);
  g.font = font; g.fillStyle = color; g.textBaseline = 'alphabetic'; g.fillText(text, padX, padY + asc);
  return cv;
}

// ---------- models (the Blender lane) ----------
/** A GLB from the job folder (made by `fcm blender`, or any glTF binary), loaded once; the render waits for it.
 *  The same scene is shared by every frame, so clone it (useFitted) before changing anything on it. */
export function useGLB(src: string): THREE.Group | null {
  return useAsync(`glb:${src}`, async () => (await new GLTFLoader().loadAsync(cardSrc(src))).scene);
}

/** A clone of a model, centred on its bounding box and scaled so its larger side (width or height) is 1. */
export function useFitted(scene: THREE.Group | null): { obj: THREE.Group; aspect: number } | null {
  return useMemo(() => {
    if (!scene) return null;
    const inner = scene.clone(true), obj = new THREE.Group();
    const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const s = 1 / Math.max(size.x, size.y, 1e-6);
    inner.position.sub(mid).multiplyScalar(s); inner.scale.multiplyScalar(s);
    obj.add(inner);
    return { obj, aspect: size.x / Math.max(size.y, 1e-6) };
  }, [scene]);
}

/** An image as a texture for a glTF mesh's UVs (flipY off, as glTF expects); null for no image. */
export function useMeshTexture(src: string): THREE.Texture | null {
  return useAsync(`meshtex:${src}`, async () => {
    if (!src) return null;
    const t = await new THREE.TextureLoader().loadAsync(cardSrc(src));
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  });
}

/** Cover-fit a texture onto a surface of aspect w / h (crops the image's long side, centred). */
export function cover(t: THREE.Texture, aspect: number): THREE.Texture {
  const im = t.image as { width: number; height: number }, a = im.width / im.height;
  if (a > aspect) { t.repeat.set(aspect / a, 1); t.offset.set((1 - aspect / a) / 2, 0); }
  else { t.repeat.set(1, a / aspect); t.offset.set(0, (1 - a / aspect) / 2); }
  return t;
}
