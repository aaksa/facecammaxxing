#!/usr/bin/env node
// Pass 2 of facecammaxxing: bundle the comp once with the job folder as its public dir, then render
// check stills or the final MP4.
//
//   node render.mjs --job <job-dir> --plan <plan.json> --still 1.2,3.4 [--out-dir <dir>]
//   node render.mjs --job <job-dir> --plan <plan.json> --out <out.mp4> [--range 0.5-3.5] [--scale 0.5] [--concurrency 4] [--crf 16]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true']);
  return acc;
}, []));
const die = (m) => { console.error(m); process.exit(1); };
if (!args.job || !args.plan) die('usage: render.mjs --job <dir> --plan <plan.json> (--still 1.2,3.4 | --out out.mp4)');

const job = path.resolve(args.job);
const track = JSON.parse(fs.readFileSync(path.join(job, 'track.json'), 'utf8'));
const IMG = /\.(jpe?g|png|webp)$/i;
const cards = fs.existsSync(path.join(job, 'thumbs')) ? fs.readdirSync(path.join(job, 'thumbs')).filter((n) => IMG.test(n)).sort().map((n) => `thumbs/${n}`) : [];
// several plans (comma-separated) share one bundle: handy for checking many effects at once
const plans = String(args.plan).split(',').map((pp, k) => {
  const raw = JSON.parse(fs.readFileSync(path.resolve(pp), 'utf8'));
  const effects = (Array.isArray(raw) ? raw : raw.effects).map((e) => ({ ...e, start: Number(e.start ?? 0), end: Math.min(Number(e.end ?? 1e9), track.duration) }));
    // image folders (images: reel cards, logos: tier-list tiles) are copied into the job, so the page can load them as static files
  effects.forEach((e, i) => ['images', 'logos'].forEach((key) => {
    if (!e[key] || typeof e[key] !== 'string' || e[key].includes('|')) return;
    const dir = path.resolve(path.dirname(path.resolve(pp)), e[key].replace(/^~(?=\/)/, os.homedir()));
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) die(`${key} folder not found: ${dir}`);
    const dst = path.join(job, key, `${k}_${i}`); fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(dst, { recursive: true });
    const names = fs.readdirSync(dir).filter((n) => IMG.test(n) || /\.svg$/i.test(n)).sort();
    if (!names.length) die(`no images in ${dir}`);
    names.forEach((n) => fs.copyFileSync(path.join(dir, n), path.join(dst, n)));
    e[key] = names.map((n) => `${key}/${k}_${i}/${n}`).join('|');
  }));
  // single files: a 3D model (prop-3d) and a screen image are copied in the same way; a bare model name is a GLB in the
  // job's models/ (from `fcm blender`), or one of the skill's built-in props
  effects.forEach((e, i) => ['model', 'image'].forEach((key) => {
    if (!e[key] || typeof e[key] !== 'string') return;
    if (key === 'model' && !/[./]/.test(e[key])) {
      const own = path.join(job, 'models', `${e[key]}.glb`), shipped = path.join(here, '..', 'props', `${e[key]}.glb`);
      if (fs.existsSync(own)) return;
      if (!fs.existsSync(shipped)) die(`model "${e[key]}" not found: make it with  fcm.py blender ${job} ${e[key]}  (or give a .glb path)`);
      fs.mkdirSync(path.dirname(own), { recursive: true }); fs.copyFileSync(shipped, own); return;
    }
    const src = path.resolve(path.dirname(path.resolve(pp)), e[key].replace(/^~(?=\/)/, os.homedir()));
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) die(`${key} file not found: ${src}`);
    const name = `${key}s/${k}_${i}_${path.basename(src)}`;
    fs.mkdirSync(path.join(job, `${key}s`), { recursive: true }); fs.copyFileSync(src, path.join(job, name));
    e[key] = name;
  }));
  return { name: path.basename(pp).replace(/\.json$/, ''), inputProps: { track, effects, cards, hasRoom: fs.existsSync(path.join(job, 'room.mp4')) } };
});

const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
process.stdout.write('Bundling... ');
const serveUrl = await bundle({ entryPoint: path.join(here, 'src/index.ts'), publicDir: job, onProgress: () => {} });
console.log(secs());
const chromiumOptions = { gl: 'angle' };
// a Chrome of your own (offline, or a locked-down network): --browser <path> or FCM_BROWSER
const browserExecutable = args.browser ?? process.env.FCM_BROWSER ?? null;
const scale = Number(args.scale ?? 1);

if (args.still) {
  const outDir = path.resolve(args['out-dir'] ?? path.join(job, 'check'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const { name, inputProps } of plans) {
    const composition = await selectComposition({ serveUrl, id: 'Facecam', inputProps, chromiumOptions, browserExecutable });
    for (const s of String(args.still).split(',').map(Number)) {
      const frame = Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(s * composition.fps)));
      const output = path.join(outDir, `${plans.length > 1 ? name + '_' : ''}${s.toFixed(2)}.png`);
      await renderStill({ composition, serveUrl, output, frame, inputProps, chromiumOptions, browserExecutable, scale, imageFormat: 'png' });
      console.log('saved', output, secs());
    }
  }
} else {
  const { inputProps } = plans[0];
  const composition = await selectComposition({ serveUrl, id: 'Facecam', inputProps, chromiumOptions, browserExecutable });
  const out = path.resolve(args.out ?? path.join(job, 'out.mp4'));
  let last = -1;
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: out, inputProps, chromiumOptions, browserExecutable, scale,
    frameRange: args.range ? String(args.range).split('-').map((v, i) => Math.min(composition.durationInFrames - 1, Math.max(0, Math.round(Number(v) * composition.fps) - i))) : undefined,
    crf: Number(args.crf ?? 16), pixelFormat: 'yuv420p', imageFormat: 'jpeg', jpegQuality: 94,
    concurrency: Number(args.concurrency ?? Math.max(1, Math.min(8, Math.floor(os.cpus().length / 2)))),
    muted: !track.audio,
    onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; console.log(`  ${p * 10}% ${secs()}`); } },
  });
  console.log('Done:', out, secs());
}
