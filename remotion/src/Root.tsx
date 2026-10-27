import React from 'react';
import { Composition } from 'remotion';
import { clipFrames, Film, introFrames } from './Film';
import { Props } from './lib/core';

// The real props come from render.mjs (track.json + the plan). These defaults only keep Studio alive.
const defaults: Props = {
  track: { fps: 30, width: 1080, height: 1920, frames: 150, duration: 5, static: false, audio: false, matte: 'none', face: [], top: [] },
  effects: [], cards: [], hasRoom: false,
};

export const Root: React.FC = () => (
  <Composition
    id="Facecam"
    component={Film as unknown as React.FC<Record<string, unknown>>}
    defaultProps={defaults as unknown as Record<string, unknown>}
    durationInFrames={150} fps={30} width={1080} height={1920}
    calculateMetadata={({ props }) => {
      const p = props as unknown as Props;
      const fps = p.track.fps, { from, to } = clipFrames(p, fps);
      const frames = p.intro ? introFrames(p.intro, fps) + (to - from) : p.track.frames;
      return { durationInFrames: Math.max(1, frames), fps, width: p.track.width, height: p.track.height };
    }}
  />
);
