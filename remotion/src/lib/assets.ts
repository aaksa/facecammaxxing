import { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender, staticFile } from 'remotion';
import * as THREE from 'three';
import { FONT, fontsReady } from './fonts';

/** Wait for a promise before Remotion takes the screenshot; returns null until it resolves. */
export function useAsync<T>(key: string, make: () => Promise<T>): T | null {
  const [v, setV] = useState<{ key: string; v: T } | null>(() => (done.has(key) ? { key, v: done.get(key) as T } : null));
  const [handle] = useState(() => (done.has(key) ? null : delayRender(`load ${key.slice(0, 60)}`)));
  useEffect(() => {
    if (v) return;
    let alive = true;
    make().then((r) => { done.set(key, r); if (alive) setV({ key, v: r }); if (handle !== null) continueRender(handle); })
      .catch((err) => cancelRender(err));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return v ? v.v : null;
}
const done = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
const once = <T,>(key: string, make: () => Promise<T>) => {
  if (!pending.has(key)) pending.set(key, make());
  return pending.get(key) as Promise<T>;
};

export const loadImage = (src: string) => once(`img:${src}`, () => new Promise<HTMLImageElement>((res, rej) => {
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => res(im); im.onerror = () => rej(new Error(`could not load ${src}`)); im.src = src;
}));

export const cardSrc = (name: string) => (/^(https?:|data:|\/)/.test(name) ? name : staticFile(name));

const TINTS = ['#ff5a5f', '#ffb400', '#20c997', '#7b61ff', '#ff8a3d', '#4d96ff', '#e84393', '#2ec4b6'];
const VIEWS = ['1.2M', '847K', '2.4M', '312K', '5.1M', '98K', '1.9M', '640K'];

/** A reel card: the image cover-fitted into 9:16, plus (ui) a colour tint, a bottom fade, a play icon and a view count. */
export async function cardCanvas(src: string, i: number, ui: boolean): Promise<HTMLCanvasElement> {
  await fontsReady;
  const im = await loadImage(cardSrc(src));
  const w = 540, h = 960, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d')!;
  const s = Math.max(w / im.width, h / im.height), dw = im.width * s, dh = im.height * s;
  g.drawImage(im, (w - dw) / 2, (h - dh) * 0.35, dw, dh);
  if (ui) {
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.55; g.fillStyle = TINTS[i % TINTS.length]; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const fade = g.createLinearGradient(0, h * 0.55, 0, h); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(40, h - 92); g.lineTo(40, h - 52); g.lineTo(74, h - 72); g.closePath(); g.fill();
    g.font = `700 38px ${FONT.ui}`; g.textBaseline = 'middle'; g.fillText(VIEWS[i % VIEWS.length], 90, h - 71);
    g.globalAlpha = 0.9; g.fillRect(0, h - 10, w * (0.25 + 0.6 * ((i * 37) % 10) / 10), 10); g.globalAlpha = 1;
  }
  return cv;
}

/** Card textures, shared by the back and front canvases of a ring. */
export function useCardTextures(srcs: string[], ui: boolean): THREE.Texture[] | null {
  const key = `tex:${ui}:${srcs.join('|')}`;
  return useAsync(key, () => once(key, async () => (await Promise.all(srcs.map((s, i) => cardCanvas(s, i, ui)))).map((cv) => {
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
    return t;
  })));
}

/** Font size that makes `text` exactly `maxW` wide (after the fonts load). */
export function useFitSize(text: string, family: string, maxW: number, weight = '400', spacing = 0): number | null {
  const key = `fit:${family}:${weight}:${spacing}:${text}`;
  const base = useAsync(key, async () => {
    await fontsReady; await document.fonts.load(`${weight} 100px "${family}"`);
    const g = document.createElement('canvas').getContext('2d')!; g.font = `${weight} 100px "${family}"`;
    return g.measureText(text).width + spacing * 100 * Math.max(0, text.length - 1);
  });
  return base ? (100 * maxW) / base : null;
}

/** A rounded-rect plane with 0..1 UVs (ShapeGeometry would use raw positions). */
export function roundedPlane(w: number, h: number, r: number): THREE.ShapeGeometry {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 10), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
  uv.needsUpdate = true;
  return g;
}

/** A soft white streak, used as a gloss highlight sliding over the cards. */
let glossTex: THREE.Texture | null = null;
export function gloss(): THREE.Texture {
  if (glossTex) return glossTex;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d')!, gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.42, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.58, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  glossTex = new THREE.CanvasTexture(cv); glossTex.colorSpace = THREE.SRGBColorSpace;
  return glossTex;
}
