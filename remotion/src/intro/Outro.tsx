import React from 'react';
import { AbsoluteFill, Img, Loop, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, e, lerp, Track } from '../lib/core';
import { FONT } from '../lib/fonts';
import { ORANGE } from '../lib/layout';
import { BG, BOX, BOXS, ChatHeader, DIM, FAINT, Fit, INK, Mic, mix, mosaic, Plus, Spark, Specks, TILE, TILE_BG, Up } from './ChatRender';

// The ending, in the same chat as ChatRender. The viewer's comment ("claude") is the sent message; Claude answers word by
// word ("Comment “claude” and I'll send you all N effects"); a dot tile resolves into a grid of every effect in the reel,
// playing, which grows to fill the screen under a "Comment “claude”" headline. A comment box then types the keyword with an
// irregular hand and posts it: the ending is still moving when the reel loops. Pure function of the frame, written in the
// frames of a 125-frame (4.17 s) reference timed on the studied reel: 2.53 s of chat (76 f), then 1.63 s of grid (49 f).
// Layout in 1080 x 1920, scaled.

export type OutroSpec = {
  segments: string[];          // the rendered effect segments (static files in the job), one grid tile each
  labels: string[];            // their names, shown on the tiles
  keyword?: string;            // claude
  count?: number;              // how many effects the DM sends (defaults to the tiles)
  skip?: number;               // frames to skip at the start of each segment (its chat intro)
  frames?: number[];           // each segment's length in frames (render.mjs measures it): tiles loop inside it
  skips?: number[];            // per-segment skip (segments with a longer intro), else `skip`
  tail?: number;               // frames to leave off each segment's end (the effect's exit), 18
  avatar?: string;             // a picture for the comment box (static file)
  seconds?: number;            // 4.17
};
export type OutroProps = { track: Track; outro: OutroSpec };

const REF = 125;
const W0 = 1080, H0 = 1920;
const TYPE_AT = 83, POST = 103;

/** The grid scene: headline, the effect tiles playing, the comment box. `f` is the outro's reference frame. */
const Grid: React.FC<{ o: OutroSpec; f: number; W: number; H: number }> = ({ o, f, W, H }) => {
  const kw = o.keyword ?? 'claude', n = o.segments.length, count = o.count ?? n;
  const cols = 3, gap = 20, tw = 228, th = 405;
  const gx = (W0 - (cols * tw + (cols - 1) * gap)) / 2, gy = 478;
  // the comment box types the keyword (irregular rhythm) and posts it
  const gaps = [0, 3, 3, 4, 3, 3, 4, 3, 3, 4];
  const typedAt = kw.split('').map((_, i) => TYPE_AT + gaps.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const typed = f >= POST + 2 ? 0 : typedAt.filter((t) => f >= t).length;
  const posted = e('expo.out', f, POST + 2, 8);
  const press = f >= POST && f < POST + 2;
  const heart = e('back.out(2.5)', f, POST + 6, 8);
  const bar = { x: 90, y: 1356, w: 850, h: 100 };
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 90% 60% at 50% 40%, #2c2a27 0%, #1b1a18 70%)', fontFamily: FONT.ui, color: INK }}>
      <div style={{ position: 'absolute', width: W0, height: H0, transform: `scale(${W / W0}, ${H / H0})`, transformOrigin: '0 0' }}>
        <div style={{ position: 'absolute', left: 0, width: W0, top: 268, textAlign: 'center', fontSize: 100, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
          Comment <span style={{ color: ORANGE }}>&ldquo;{kw}&rdquo;</span>
        </div>
        <div style={{ position: 'absolute', left: 0, width: W0, top: 392, display: 'flex', justifyContent: 'center' }}>
          <div style={{ padding: '10px 30px', borderRadius: 30, background: ORANGE, color: '#fff', fontSize: 34, fontWeight: 700 }}>to get all {count} effects</div>
        </div>
        {o.segments.map((src, i) => {
          const x = gx + (i % cols) * (tw + gap), y = gy + Math.floor(i / cols) * (th + gap);
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: tw, height: th, borderRadius: 18, overflow: 'hidden', background: '#111', border: '1.5px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px rgba(0,0,0,0.45)' }}>
              {/* each tile loops its effect's own window: after the chat intro, before the effect's exit */}
              <Loop durationInFrames={Math.max(12, (o.frames?.[i] ?? 150) - (o.skips?.[i] ?? o.skip ?? 0) - (o.tail ?? 18))} layout="none">
                <OffthreadVideo muted src={staticFile(src)} startFrom={o.skips?.[i] ?? o.skip ?? 0} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </Loop>
              <div style={{ position: 'absolute', left: 10, bottom: 10, padding: '5px 12px', borderRadius: 14, background: 'rgba(10,10,12,0.66)', fontSize: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>{o.labels[i]}</div>
            </div>
          );
        })}
        {/* the comment box */}
        <div style={{ position: 'absolute', left: bar.x, top: bar.y, width: bar.w, height: bar.h, borderRadius: 50, background: '#262523', border: '1.5px solid rgba(255,255,255,0.14)' }} />
        <div style={{ position: 'absolute', left: bar.x + 14, top: bar.y + 14, width: 72, height: 72, borderRadius: 36, overflow: 'hidden', background: '#3a3936' }}>
          {o.avatar ? <Img src={staticFile(o.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%', transform: 'scale(1.9)' }} /> : null}
        </div>
        <div style={{ position: 'absolute', left: bar.x + 108, top: bar.y, height: bar.h, display: 'flex', alignItems: 'center', fontSize: 40, whiteSpace: 'pre' }}>
          {typed ? <span>{kw.slice(0, typed)}</span> : <span style={{ color: FAINT }}>Add a comment...</span>}
          {f >= TYPE_AT - 6 && f < POST && Math.floor(f / 7) % 2 === 0 ? <span style={{ display: 'inline-block', width: 3, height: 44, background: INK, marginLeft: 2, order: typed ? 1 : -1 }} /> : null}
        </div>
        <div style={{
          position: 'absolute', right: W0 - bar.x - bar.w + 34, top: bar.y, height: bar.h, display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 700,
          color: typed ? ORANGE : '#5f5d58', transform: `scale(${press ? 0.88 : 1})`,
        }}>Post</div>
        {/* the posted comment rises out of the box, a heart lands on it */}
        {f >= POST + 2 ? (
          <div style={{ position: 'absolute', left: bar.x, top: bar.y - lerp(0, 118, posted), height: 90, display: 'flex', alignItems: 'center', gap: 16, opacity: clamp((f - POST - 2) / 2) }}>
            <div style={{ width: 58, height: 58, borderRadius: 29, overflow: 'hidden', background: '#3a3936', marginLeft: 20 }}>
              {o.avatar ? <Img src={staticFile(o.avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%', transform: 'scale(1.9)' }} /> : null}
            </div>
            <div style={{ padding: '12px 26px', borderRadius: 28, background: '#33322f', fontSize: 38, fontWeight: 600 }}>{kw}</div>
            {heart > 0 ? (
              <svg width={52} height={52} viewBox="0 0 24 24" style={{ transform: `scale(${heart * (1 + 0.06 * Math.sin((f - POST) * 0.4))})` }}>
                <path d="M12 21 C5 15.5 2 12.3 2 8.6 A4.9 4.9 0 0 1 12 6 A4.9 4.9 0 0 1 22 8.6 C22 12.3 19 15.5 12 21 Z" fill={ORANGE} />
              </svg>
            ) : null}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const Outro: React.FC<OutroProps> = ({ outro }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const seconds = outro.seconds ?? 4.17;
  const f = (frame / fps) * 30 * (4.17 / seconds);
  const kw = outro.keyword ?? 'claude', count = outro.count ?? outro.segments.length;
  // Claude's reply, streamed word by word at speech rhythm
  const reply = `Comment “${kw}” and I'll send you all ${count} effects`.split(' ');
  const wordAt = (i: number) => 8 + i * 3.5 + (i > 1 ? 2 : 0);
  const TILE_IN = 42, DOTS_A = 46, RES = 64, GROW = 70, FULL = 80;   // measures 2.53 s of chat, as in the reference
  const grow = e('power3.inOut', f, GROW, FULL - GROW);
  const tile = mix({ ...TILE, y: 640, h: 1080, w: 608 }, { x: 0, y: 0, w: W0, h: H0, r: 0 }, grow);
  const clip = grow > 0 ? null : mosaic(608, 1080, f, DOTS_A, RES);
  const bubble = e('expo.out', f, 0, 6);
  if (f >= FULL) return <Grid o={outro} f={f} W={W} H={H} />;
  return (
    <AbsoluteFill style={{ backgroundColor: BG, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: W0, height: H0, transform: `scale(${W / W0}, ${H / H0})`, transformOrigin: '0 0', fontFamily: FONT.ui, color: INK }}>
        <ChatHeader />
        {/* the viewer's comment, sent */}
        <div style={{
          position: 'absolute', right: 40, top: 214, height: 84, padding: '0 34px', borderRadius: 42, background: '#3a3936', display: 'flex', alignItems: 'center',
          fontSize: 44, transform: `translateY(${(1 - bubble) * 40}px)`, opacity: clamp(f / 2),
        }}>{kw}</div>
        {/* Claude's reply */}
        {f >= 6 ? <Spark x={78} y={378} s={40} rot={f * 8} /> : null}
        <div style={{ position: 'absolute', left: 124, top: 348, width: 880, fontSize: 48, lineHeight: 1.3, fontWeight: 500 }}>
          {reply.map((w, i) => (f >= wordAt(i)
            ? <span key={i} style={{ display: 'inline-block', marginRight: '0.28em', opacity: clamp((f - wordAt(i)) / 2), transform: `translateY(${(1 - e('expo.out', f, wordAt(i), 4)) * 10}px)`, color: w.includes(kw) ? ORANGE : INK }}>{w}</span>
            : null))}
        </div>
        {/* the reply bar */}
        <div style={{ position: 'absolute', left: BOXS.x, top: BOXS.y, width: BOXS.w, height: BOXS.h, borderRadius: 56, background: BOX, border: '1.5px solid rgba(255,255,255,0.07)' }} />
        <Plus x={92} y={1823} s={38} c={DIM} />
        <div style={{ position: 'absolute', left: 132, top: 1795, height: 56, display: 'flex', alignItems: 'center', fontSize: 40, color: FAINT }}>Reply to Claude...</div>
        <Mic x={918} y={1823} s={38} c={DIM} />
        <div style={{ position: 'absolute', left: 961, top: 1786, width: 74, height: 74, borderRadius: 37, background: '#3c3b38' }} />
        <Up x={998} y={1823} s={38} c="#8d8b86" />
        {/* the tile: specks, a mosaic of the grid, then it grows to fill the screen */}
        {f >= TILE_IN ? (
          <div style={{
            position: 'absolute', left: tile.x, top: tile.y, width: tile.w, height: tile.h, borderRadius: tile.r, overflow: 'hidden', background: TILE_BG,
            opacity: clamp((f - TILE_IN) / 2), transform: grow > 0 ? undefined : `scale(${lerp(1.06, 1, e('expo.out', f, TILE_IN, 5))})`, transformOrigin: '0 0',
          }}>
            {f < RES ? <Specks f={f} w={608} h={1080} fade={clamp((f - (RES - 4)) / 4)} from={TILE_IN} /> : null}
            {f >= DOTS_A ? (
              <div style={{ position: 'absolute', inset: 0, clipPath: clip ?? undefined }}>
                <Fit r={{ x: 0, y: 0, w: tile.w, h: tile.h, r: 0 }} W={W} H={H}><Grid o={outro} f={f} W={W} H={H} /></Fit>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const outroFrames = (o: OutroSpec, fps: number) => Math.round((o.seconds ?? 4.17) * fps);
export { REF as OUTRO_REF };
