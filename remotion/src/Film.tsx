import React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { IntroSpec, Props } from './lib/core';
import { EFFECTS, resolveFx } from './effects';
import { ChatRender } from './intro/ChatRender';
import { Stage } from './Stage';

// The whole film: an optional intro (ChatRender), then the clip with its effects. The intro's tile resolves into the
// clip's first frame and grows to fill the screen, so the hand-over is a hard cut onto the same picture.

export const introFrames = (intro: IntroSpec | null | undefined, fps: number) => (intro ? Math.round((intro.seconds ?? 2.5) * fps) : 0);
/** The clip's frames [from, to) when an intro trims it; the whole clip otherwise. */
export const clipFrames = (p: Props, fps: number) => {
  const from = Math.max(0, Math.round((p.clip?.from ?? 0) * fps));
  const to = Math.min(p.track.frames, p.clip?.to !== undefined ? Math.round(p.clip.to * fps) : p.track.frames);
  return { from, to: Math.max(from + 1, to) };
};

/** "/glass-graph" and a one-line description from the plan's first effect, unless the plan names them. */
function introText(p: Props) {
  const fx = p.effects[0]?.fx ?? 'effect';
  const desc = EFFECTS[resolveFx(fx)]?.desc ?? '';
  return {
    command: p.intro?.command || `/${resolveFx(fx)}`,
    description: p.intro?.description || desc.replace(/\s*\([\d.]+ s\)$/, '').split(/[,;:]/)[0],
  };
}

export const Film: React.FC<Props> = (p) => {
  const { fps } = useVideoConfig();
  if (!p.intro) return <Stage {...p} />;
  const N = introFrames(p.intro, fps), { from } = clipFrames(p, fps);
  const { command, description } = introText(p);
  const vid: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence durationInFrames={N} name="ChatRender">
        <ChatRender
          command={command} description={description} file={p.intro.file} seconds={p.intro.seconds}
          thumbnail={<Freeze frame={from}><OffthreadVideo muted src={staticFile('source.mp4')} style={vid} /></Freeze>}
          next={<Freeze frame={from}><Stage {...p} silent /></Freeze>}
        />
      </Sequence>
      <Sequence from={N} name="Clip">
        <Sequence from={-from}><Stage {...p} /></Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
