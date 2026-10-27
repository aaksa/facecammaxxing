import React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';
import { IntroSpec, Props } from './lib/core';
import { EFFECTS, resolveFx } from './effects';
import { ChatRender, chatTiming } from './intro/ChatRender';
import { Stage } from './Stage';

// The whole film: an optional intro (ChatRender), then the clip with its effects. The intro's tile resolves into the
// clip's first frame and the clip starts playing inside the tile (frame R); the tile grows to fill the screen and the film
// carries on with the same clip from where the tile had got to, so nothing plays twice.

export const introFrames = (intro: IntroSpec | null | undefined, fps: number) => (intro ? chatTiming(intro.seconds ?? 2.4, fps).N : 0);
/** Frames before the clip starts (it starts inside the intro's tile, before the intro ends). */
export const introLead = (intro: IntroSpec | null | undefined, fps: number) => (intro ? chatTiming(intro.seconds ?? 2.4, fps).R : 0);
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
    command: p.intro?.command || `/effects ${resolveFx(fx)}`,
    description: p.intro?.description || desc.replace(/\s*\([\d.]+ s\)$/, '').split(/[,;:]/)[0],
    base: p.intro?.base || `${Object.keys(EFFECTS).length} video effects for your clips`,
  };
}

export const Film: React.FC<Props> = (p) => {
  const { fps } = useVideoConfig();
  if (!p.intro) return <Stage {...p} />;
  const { N, R } = chatTiming(p.intro.seconds ?? 2.4, fps), { from } = clipFrames(p, fps);
  const { command, description, base } = introText(p);
  const vid: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Sequence durationInFrames={N} name="ChatRender">
        <ChatRender
          command={command} description={description} base={base} file={p.intro.file} seconds={p.intro.seconds ?? 2.4}
          tag={p.intro.tag} placeholder={p.intro.placeholder}
          thumbnail={<Freeze frame={from}><OffthreadVideo muted src={staticFile('source.mp4')} style={vid} /></Freeze>}
          next={<>
            <Sequence durationInFrames={R} layout="none"><Freeze frame={from}><Stage {...p} silent /></Freeze></Sequence>
            <Sequence from={R} layout="none"><Sequence from={-from} layout="none"><Stage {...p} /></Sequence></Sequence>
          </>}
        />
      </Sequence>
      <Sequence from={N} name="Clip">
        <Sequence from={-(from + N - R)}><Stage {...p} /></Sequence>
      </Sequence>
    </AbsoluteFill>
  );
};
