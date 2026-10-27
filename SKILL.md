---
name: facecammaxxing
description: Facecam maxxing - add pro motion-graphics effects to a real talking-head clip (a facecam / selfie / phone video of the user talking), rendered with Remotion + GSAP + Three.js (and headless Blender for modelled 3D props) over a clean cut-out of the person, directed with an award-level reel director's workflow (brief, one idea per sentence, a beat plan where every effect says what it makes the viewer believe, hardest beat first, measured self-review). It is a library of 22 effects, all equal, grouped by the job they do: proof and numbers - over-the-shoulder (camera pushes over each shoulder to Before / After proof cards behind the head, with motion blur), kallaway-split (the clip drops into a card on grid paper and the creator's numbers rise out of its top edge as a skyline that peaks behind their head), glass-graph, glass-widgets, tier-list (S-D tier list builds under the chin); type and captions - text-behind (a huge word rises from behind the head), backdrop-word, kinetic-caption (word-by-word captions in two type faces, editorial or podcast style, top words tucked behind the head); camera, light and look - lean-in (punch-in with motion blur and depth of field), slow-push, spotlight, color-grade (flat LOG look wiped into a cinematic grade with Before / After), grade, locked-on; 3D and depth - prop-3d (a Blender-modelled trophy, a clock whose hands sweep the hours, a coin, a phone showing the real screen, a check, an X, or any GLB, lit like the room), carousel-spin and orbit of reels; people, openers and framing - freeze-frame (shot freezes, room greys, white sticker outline + name tag), name-tag (lower third), silhouette-intro, window-cards (retro desktop windows of your reels that a cursor clicks), bottom-fade. Effects track the face, sit behind or in front of the person, never cover the face, keep out of the Reels UI zones and follow measured motion rules. Use when the user says facecam maxxing / facecammaxxing, gives a talking-head clip and asks for an effect, names one of the effects, asks for "text behind my head", "cards behind me", kinetic / word-by-word captions, a lower-third name tag, retro window cards, a silhouette intro, a Kallaway split / split-screen chart, a freeze frame, a tier list, a before/after grade, a 3D object / prop / trophy / Blender model next to them, or wants the Claude-edit style effects on their own footage.
---

# Facecam maxxing

Work as an award-winning motion designer, UI designer and Three.js developer directing short vertical film: the person on camera
is the hero, every effect performs the sentence it lands on, every frame is worth a screenshot, and you judge your own stills and
render instead of self-certifying. **Read `docs/director.md` (the workflow, the judgment and which tool does which job, distilled
from pro-animation-director) and `docs/motion-rules.md` (the measured numbers) before planning, changing or adding an effect.**

The stack, one job each:
- **Remotion** - frames and layers: one stage stacks **room → behind → sticker → you → front → screen** under one camera; deeper
  layers zoom less (real parallax).
- **GSAP** - choreography: timelines built paused and seeked to the frame (seek-safe), eases for every move.
- **Three.js** - depth, light and material (`remotion/src/lib/three.tsx`): rings of cards, slabs, clearcoat, reflections, GLB props.
- **Blender**, headless - only when a beat needs a modelled object: a Python script (`scripts/blender/`) → GLB → `prop-3d`.

Under it, a Python pass (`scripts/track.py`) splits the clip into layers: `source.mp4` (8-bit H.264 at 1080 wide), `person.webm`
(the person cut out with alpha, RobustVideoMatting; MediaPipe fallback), a smoothed face path and head top (YuNet), and on a
still camera a clean plate + `room.mp4` with the person removed.

All paths below are relative to this skill's folder. Everything runs through `scripts/fcm.py` with the skill's own venv:
`PY=<skill>/.venv/bin/python`, `FCM="$PY <skill>/scripts/fcm.py"`.

## The workflow (in this order, never skip)

### 0. First run
`$FCM setup` (or `bash scripts/setup.sh`) prints READY. It makes the venv (uv, Python 3.11), downloads the three models and
installs the Remotion project (needs Node 22+; nvm's v22 is found automatically). The first render downloads Remotion's headless
Chrome (~170 MB) once; offline, point it at a Chrome of your own with `FCM_BROWSER=/path/to/chrome`. Blender is optional: only
new props need it (see step 5).

### 1. Brief
Fill the BRIEF at the end of `docs/director.md` with the user: the one true thing the clip says, audience and language, the source
of every number, which side the room's key light is on, and (for a whole reel) the KEYWORD. Ask for the real numbers; a blank
line means stop and ask, not invent.

### 2. Track the clip (once per clip)
`$FCM track <video> [<job-dir>]` - default job dir `./<video-name>_facecam`. ~40 s for a 7 s 4K clip. It reports whether the
camera is still (parallax and the clean room need a still camera; on a moving camera those moves fall back to flat zooms).
If the clip is on an SD card or external drive, put the job dir in the project, not on the card.
Look at one frame of `person.webm` over a colour (see "Checking the cut-out") before going on: every behind-you effect is only as
good as this matte.

### 3. Listen: word times
`$FCM words <job>` (whisper word times into `words.json`). Read the transcript as a script (hook → proof → mechanism → payoff →
CTA) and mark the sentences that carry a claim: those are the beats; the rest stays clean footage. An effect lands ~2 frames
before its word. With no timing given, ask once, or place it where the clip is calm. Never let an effect run into the last ~0.8 s
if the person reaches for the camera there.

### 4. Beat plan
For each beat, find the idea that belongs only to that sentence (never the first association; cover the creator's name and ask if
anyone could run the same effect on the same line). Proof gets proof (real numbers, real UI), a claim gets a **literal prop**
(hours → `clock`, money → `coin`, the win → `trophy`, rejection → `x`, "the app" → `phone` with the real screenshot), opinions get
type, lists get a tier list, a reveal gets a camera move. One effect per sentence, one accent event each. Write it down next to
the job, every entry with `buys` (what the viewer believes after it) and `on` (its word) - effects ignore both, the review reads them:
```json
{"effects": [
  {"fx": "over-the-shoulder", "start": 0.3, "end": 3.1, "before": "1,204 views", "after": "412K views",
   "buys": "this format took them from 1K to 412K", "on": "views"},
  {"fx": "prop-3d", "start": 3.4, "end": 5.6, "model": "clock", "hours": 6, "light": "left",
   "buys": "it saves six hours a week", "on": "hours"},
  {"fx": "text-behind", "start": 5.8, "end": 8.8, "text": "VIRAL", "buys": "the result is the point", "on": "viral"}
]}
```

### 5. Pick the lane, model what is missing
Each beat's lane is the lightest that can carry its idea: HTML/CSS + GSAP for type, cards and UI; Three.js for depth, light and
material; Blender only for a modelled object. The built-in props (`trophy`, `clock`, `coin`, `phone`, `check`, `x`) ship as GLBs
in `props/` and need no Blender. For a new one, or a new colour:
```bash
$FCM blender <job> coin --color '#D97757' --name coin      # a built-in prop, recoloured  -> <job>/models/coin.glb
cp scripts/blender/template.py my_mic.py                   # a prop of your own, built with scripts/blender/kit.py
$FCM blender <job> my_mic.py --name mic                    # -> <job>/models/mic.glb, used as "model": "mic"
```
It finds Blender 3.6+ (`$BLENDER`, PATH, the macOS app, snap, flatpak) or a Python 3.11 with `pip install bpy` (`$BLENDER_PY`).
Prop conventions (front faces -Y, named moving parts, PBR only, low-poly) are in `docs/director.md`.

### 6. Hardest beat first, then check stills
Build the hero beat alone first. `$FCM check <job> plan.json` (or `--at 1.2,3.4`) renders stills at 30 % and 60 % of every effect
and a contact sheet `<job>/check/<plan>/sheet.jpg`. **Look at the sheet yourself.** Fix what covers the face, clips at an edge,
lands in a platform zone, reads too small, or (for a prop) is lit from the wrong side - then check again, then add the other beats.

### 7. Render, review, deliver
`$FCM render <job> plan.json [--out final.mp4] [--draft] [--range 0.3-3.3]`. ~25 s for a 7 s clip at 1080p. The original audio is
kept. `--draft` is half size. Watch it at real speed and answer the self-review in `docs/director.md` in writing; fix in the order
untrue → face / platform UI → idea → connections → hierarchy → timing → finish. Deliver the file path, the cover frame and the
short NOTE (each effect and what it buys, what is real vs illustrative, what you would still fix), and remind the user in one line
to watch it before posting.

Some effects are written against a set length (over-the-shoulder 2.8 s, kallaway-split 4 s, window-cards 1.8 s; freeze-frame,
tier-list, text-behind, color-grade and glass-graph 3 s). Give them that window; a longer window slows every move to match (the user
can ask "make it 4 seconds"). `$FCM list` prints every effect and its options (read from the code, so it is always current).

## The effect library
22 effects, all equal: one library, grouped here only by the job they do in a beat (proof gets proof, a claim gets a prop, a reveal
gets a camera move). Every effect has a ready plan in `examples/<fx>.json` and a demo render of it in `demo/<fx>.mp4`; two
combined plans show effects working together (`examples/editorial-hook.json`, `examples/podcast-hook.json`).

### Proof and numbers
| fx | What happens | Options |
|---|---|---|
| `over-the-shoulder` | Camera pushes over the left shoulder to a Before card, swings to the right for After, settles. Cards slide out from behind the head and tuck back; motion blur follows camera speed. | `before`, `after`, `before_label`, `after_label`, `parallax` |
| `kallaway-split` | "You're the peak": plays full frame, then drops (motion-blurred, its shadow tightening as it lands) into a rounded card on grained grid paper. The card's top edge is the chart's ground: bars rise out from behind it as a skyline that peaks behind your head, the best number in Claude orange, the rest hatched in ink falling away to both sides, values counting up from the outside in, the hero last. A marker loop circles the hero; the title's accent word gets a marker underline; opens back to full frame. | `bars` (`Label:Value\|...`), `title`, `by`, `accent`, `pop`, `card`, `scale` |
| `glass-graph` | A frosted glass card rises at chest height; the number counts up in 18 frames and an orange graph draws with it. | `text`, `from`, `to`, `color` |
| `glass-widgets` | Frosted glass widgets around your head: a counting stat, a climbing watch-time graph, a follow card, an "Edited by Claude" pill. | `text`, `label`, `delta`, `graph`, `hours`, `name`, `handle`, `pill`, `tone` (dark \| light) |
| `tier-list` | Classic creator tier list (pastel S-D tiles, charcoal bars, white items) under the chin; items drop in every 4 frames, rows nudge as they land, status rolls to "Ranked". | `text` (topic), `S` `A` `B` `C` `D` (items with `\|`), `logos` (folder; file names = items) |

### Type and captions
| fx | What happens | Options |
|---|---|---|
| `text-behind` | A huge condensed word rises out from behind the body, focusing, holds behind the head with a slow lift, sinks back (or `exit: blow`). | `text`, `color`, `height`, `y`, `exit` |
| `backdrop-word` | A giant word drops in behind you letter by letter, with motion blur, and stays still while the camera moves. | `text`, `color`, `font` (anton \| bold \| serif), `width`, `y` |
| `kinetic-caption` | Words land one at a time, each focusing up from a blur. Big words are condensed caps (editorial) or heavy tight sans (podcast); `_underscored_` words are the small voice (a script, or small white). At `y: top` the last line straddles the top of your head and sits behind you; lower down it is in front and keeps its size through a punch-in. Leaves by `drop` (falls out with vertical motion blur) or `blow` (grows past the camera, going soft). | `text` (`_If you want your_ / CONTENT`), `style` (editorial \| podcast), `y` (top \| chest \| low \| 0-1), `layer`, `times` (clip seconds per word from `fcm words`), `rate` (4 frames), `size`, `color`, `exit`, `exit_dur` |

### Camera, light and look
| fx | What happens | Options |
|---|---|---|
| `lean-in` (`punch-in`) | The hard punch on one word: in over 5 frames with camera motion blur while the room and the words behind you go soft (`dof`), a slow creep while it holds, out over 6 frames. | `zoom`, `parallax`, `dof`, `in`, `out` |
| `slow-push` | A slow cinematic push-in while the room melts out of focus; real parallax on a still camera. | `zoom`, `blur`, `parallax` |
| `spotlight` | The lights go down, you stay lit with a warm rim, an optional glowing word behind you. | `text`, `color`, `push` |
| `color-grade` | Flat LOG look; a line of light wipes across leaving a cinematic teal/warm grade; Before / After pills ride the line. | - |
| `grade` | A colour grade on the room and you, with a vignette. | `grade` (moody \| bw \| warm \| cool \| pop) |
| `locked-on` | Corner brackets snap onto your face, a tag and a readout, and the camera follows you. It uses page chrome the director's rules list under "never ship": use it when the user asks for it. | `zoom`, `text`, `color` |

### 3D and depth
| fx | What happens | Options |
|---|---|---|
| `prop-3d` | A modelled prop (Blender GLB) lands beside your head (the side with more room; under the chin when neither fits) from oversize, turning into place, sways or spins while it holds, and drops out with motion blur. Lit by the studio environment plus a key light from the room's side, with a soft shadow. A clock's hands sweep `hours` and land exactly on the new time; a phone shows `image` (the real screenshot) on its screen, unlit so the UI reads true. | `model` (`trophy` \| `clock` \| `coin` \| `phone` \| `check` \| `x` \| a name in `<job>/models/` \| a `.glb` path), `side` (auto \| left \| right \| chin), `size`, `y`, `layer` (front \| behind), `spin` (deg/s; 0 = sway), `sway`, `tilt`, `light` (left \| right), `key`, `hours`, `time` (10:10), `image` |
| `carousel-spin` | Your reels spin around you in a real 3D carousel (Three.js), the front cards passing under your chin, then settle. | `images` (folder), `count`, `size`, `radius`, `tilt`, `turns`, `dof` |
| `orbit` | Your reels orbit your head in 3D: behind you at the top, in front at the bottom. | `images` (folder), `count`, `size`, `speed`, `tilt` |

### People, openers and framing
| fx | What happens | Options |
|---|---|---|
| `freeze-frame` | Shot freezes with a 4 % pop, room greys over 12 frames, white sticker outline + name tag, slow push while frozen, then lets go. | `name`, `role`, `flash` (0/1) |
| `name-tag` | Lower third: an outlined pill open on the left edge, name + role, slides in from the left focusing, slides back out. | `name`, `role`, `y` |
| `silhouette-intro` | The first few frames show you as a flat cream silhouette over the real room, then the footage cuts in. Put it at 0. | `frames` (4), `color` |
| `window-cards` | Retro desktop windows showing your reels (`thumbs/` or `images`) slide in under the chin like a conveyor; a cursor flies in and clicks one; it grows to the centre while the others leave; all drop out. | `images`, `count` (4), `pick` (2), `grow`, `title`, `titles` |
| `bottom-fade` | The bottom of the frame fades to dark (over you, under the captions: list it before them), optional soft room. | `amount`, `from`, `soft` |

Combining them: run `$FCM words <job>` and pass each caption's word starts as `times`, so every word lands on the voice. Chest
captions, `window-cards`, `tier-list` and chin props share the band under the chin: don't overlap them in time. Yellow editorial
captions want a darker wall; on a light wall pass `color` (or use `style: podcast` with `color: "#ffffff"`). Put camera effects
first in the plan; don't stack a full-width word with a big push.

## Intro: ChatRender, and the Outro
**ChatRender** (~2.4 s) opens any render with the chat beat of the studied "36 effects" reel (`references/instagram/De7JFJdo4KX.mp4`,
local only): a warm dark chat (menu, a Chat / Code toggle, compose), the clip attached in the "Reply to Claude..." box. "/"
opens a command card, "e" is typed and the card tapped to autocomplete `/effects`, two letters of the effect are typed and
tapped to complete it; the command turns orange once recognised; letter keys pop a magnified balloon and the predictive bar
quotes the word. Send: the keyboard drops, the clip and the orange command go up as the sent message, "Editing with
<effect>..." spins beside a small `SPED UP` tag, and a big 9:16 tile of orange specks fills into a mosaic that resolves into
the clip. The clip **plays inside the tile** from that frame on, the tile grows to fill the screen, and the film carries on
from there (nothing plays twice).
```json
{"intro": {"command": "/effects kallaway-split", "description": "your numbers rise as a chart above you"},
 "effects": [{"fx": "kallaway-split", "start": 0.2, "end": 4.2}]}
```
- `intro` takes `command` (default `/effects <first effect>`), `description` (the effect's card line), `base` (the
  `/effects` card line, default "N video effects for your clips"), `tag` (`SPED UP`, `""` for none), `placeholder` and
  `seconds` (2.4; every beat stretches to match). `"intro": true` or `fcm render ... --intro` uses the defaults.
- With an intro, `--range 0.2-4.4` picks the part of the clip that follows it; start it where the first effect starts.
  `fcm check` adds stills of the intro's beats (`i0.6` is 0.6 s into the intro).
- Its message box and keyboard sit in the bottom platform zone by design: it is a phone screen, not an overlay.

**Outro** (~4.4 s) ends a reel on the comment keyword: the viewer's comment ("claude") is the sent message, Claude answers
word by word ("Comment “claude” and I'll send you all N effects"), a dot tile resolves into a grid of every effect segment
playing, which fills the screen under a "Comment “claude”" headline with an orange "to get all N effects" pill; a comment box
then types the keyword and posts it, and a heart lands. A plan with `"outro"` renders it:
```json
{"outro": {"segments": ["1_kallaway-split.mp4", "..."], "labels": ["kallaway-split", "..."], "keyword": "claude", "count": 22, "skip": 60}}
```
`segments` are rendered effect MP4s (paths relative to the plan), `skip` the frames to skip into each (its chat intro), `count`
what the DM really sends. A full reel = one render per effect with its intro, then the outro, joined with hard cuts
(`ffmpeg -f concat`); see `examples/reel/run.sh`. Components: `remotion/src/intro/ChatRender.tsx`, `remotion/src/intro/Outro.tsx`,
`remotion/src/Film.tsx`.

## Rules (read `docs/director.md` and `docs/motion-rules.md` before changing or adding an effect)
- **Never cover the face.** Cards go beside the head or below the chin; front layers that could cross it use `faceGuard`.
- **Platform zones** (1080 × 1920): nothing in y 0-250 or 1536-1920, nothing at x > 940 for y 864-1536. Panels under the chin
  shrink to fit (to ~0.72) instead of entering the caption zone. A face that sits low in the frame leaves little room under the
  chin: say so, and suggest framing with the eyes at about a third of the height next time.
- **Real numbers.** The defaults (1,204 → 412K, the AI-tools tier list) are examples. Ask for the user's real numbers; if they
  have none, mark the numbers as examples on screen or in the caption.
- **Motion**: entries do most of their travel in the first 4-8 frames, exits ease in; things arrive by moving, unmasking or
  focusing, almost never by fading; one visible spring per film (the freeze-frame pop); no light flashes; every hold keeps one
  living thing.
- Visuals only: sound effects and captions are added elsewhere (CapCut, or reelmaxxing's captions).

## Adding an effect
An effect is an `FxDef` in `remotion/src/effects/` (see `lib/core.ts`): optional `camera`, `room` / `person` / `world` CSS
filters, `Behind` / `Front` / `Screen` components, `freeze`, `sticker`, `personScale`, `split`, `card` + `Backdrop` (shrink the shot into a card over a set), `cameraBlur`, `depth`.
Every component is a pure function of `c.t` (seconds into the effect) and `c.face`; use `specFrame(c, N)` to write timings in
30 fps frames of an N-frame reference. 3D goes through `lib/three.tsx`: `PixelCanvas` (z = 0 is the frame in pixels, `at()` places
things), `roundedBox`, `usePainted` / `textCanvas`, and for Blender models `useGLB` + `useFitted` (+ `useMeshTexture` / `cover` for
an image on a named mesh); `effects/Prop3D.tsx` is the worked example. Use `useTimeline` (GSAP built paused, seeked per frame) or `e()` / `fr()` eases - never
a timeline that plays on its own clock, never `Math.random()` without a seed. Register it in `effects/index.tsx`, run
`npx tsc --noEmit` in `remotion/`, then check stills.

## Checking the cut-out
```bash
ffmpeg -v error -y -ss 2 -c:v libvpx-vp9 -i <job>/person.webm -frames:v 1 /tmp/p.png
ffmpeg -v error -y -f lavfi -i color=c=0xff3366:s=1080x1920 -i /tmp/p.png -filter_complex overlay -frames:v 1 /tmp/matte.jpg
```
Hair edges should be clean and props the person holds (a mic) kept. If it is soft or flickers, re-track with
`--matte mediapipe` to compare, or improve the light on the next shoot.

## Credits and licences
Based on [claude-video-effects](https://github.com/Vibha-Ramprakash/claude-video-effects) by Vibha Ramprakash
(@vibha.in.progress, MIT): the idea, many effect concepts and names, and the ChatRender / ending look. Keep this credit.
Face: OpenCV YuNet (MIT). Cut-out: RobustVideoMatting (GPL-3.0, downloaded at setup, not bundled) or MediaPipe Selfie
Segmenter (Apache 2.0). Fonts via @remotion/google-fonts (OFL). Remotion is free for individuals and companies of up to 3
people; larger teams need a Remotion company licence. GSAP and Three.js are free. Blender and the `bpy` module are GPL; they are only run as tools, and the props you make with them are
yours. The built-in props in `props/` were made with `scripts/blender/props.py` and are MIT like the rest of this skill's code.
