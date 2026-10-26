# Motion rules for facecam effects

Distilled from *pro-animation-director* (the reelmaxxing / motionmaxxing house rules) down to what applies to an effect laid
over a real talking-head clip. These numbers are measured at 30 fps, and every effect in the library is held to them. Where an
effect's original look breaks a rule, the rule wins and the original stays available as an option (noted below).

## Timing
- **Land decelerates, leave accelerates.** An entry does most of its travel in the first 4-8 frames, then a long soft tail
  (`expo.out` / `power3.out`). An exit eases in and leaves (`power2.in`). The median move is about 10 frames.
- **Arrive from oversize, never from zero.** Cards, chips and tags pop in over ~6 frames from scale ~1.45 and -6° (mirror the
  angle on the other side). Nothing grows from scale 0.
- **One visible spring per film.** Here it is the freeze-frame's 4 % body pop. Everything else lands without overshoot.
- **Counters** step every frame for 8-18 frames and land exactly on the value (no long crawl, no near-miss).
- **Punch-in** on a key word: a subtle one is 1 → 1.06-1.08 in 5 frames, back over ~24 frames. The editorial punch (`lean-in`,
  from the studied reel) is harder: 1 → 1.3 in 5 frames with camera motion blur and the room / behind words going soft, a
  slow creep while held, back out in 6 frames. One hard punch per sentence at most.

## Arrival and exit
- **Exits leave by moving.** A front caption or card drops out of frame with vertical motion blur (`drop`); a word behind
  you grows past the camera and goes soft (`blow`). Both ease in over ~8 frames.
- **Almost nothing fades.** Things arrive by moving, unmasking (rising out from behind your body, being revealed by a wipe line)
  or focusing (blur to sharp). A fade, if any, lasts 2-4 frames and hides inside a move.
- **No dead frame.** A held shot keeps one living thing: a slow drift, a lift, a pulse, a slow push on a frozen frame.
- **Light stays stable.** No flashes or sudden brightness pops; ramp a light change over 12-30 frames.
  (Guide conflict: the freeze-frame's white flash is off by default, `flash=1` brings it back.)

## Emphasis
- One lit thing per frame (three at most), one accent event per effect: a punch-in OR a pop OR a pulse.
- Big needs small around it: one hero number per card, everything else small and quiet.
- One material for the whole film: glass (smoked or clear) with a thin light border and a soft shadow. No zinc-grey web UI,
  no status dot + "label · value" cards.
- One accent colour with one meaning: Claude orange `#D97757` = the win.
- A 3D prop (`prop-3d`) follows the same rules as a card: arrives from oversize in ~6 frames while turning into place over ~14,
  sways or spins while held (the living thing), drops out over 8 frames. It is lit from the room's key side (`light`) and
  casts a soft shadow; a prop lit differently from the room reads as a sticker.

## Layout (1080 × 1920, scale for other sizes)
- Keep out of the top 0-250 px (platform UI), the bottom 1536-1920 px (caption and username) and the right rail
  (x > 940 for y 864-1536).
- Hero zone 400-1300. Never cover the face: cards go below the chin or beside the head. If the face sits low in the frame,
  panels shrink to fit the band under the chin (down to ~0.7) before they ever touch the caption zone.
- Proof must read on a phone: the hero number at least ~4 % of the frame height (≈ 77 px at 1920).

## Never ship
- Page chrome: corner brackets, timecodes, tracked-caps labels, scene counters, progress bars.
- A giant word cropped by the frame edge.
- Invented numbers presented as real: the defaults (1,204 → 412K, the AI-tools tier list) are examples; replace them with the
  creator's real numbers, or say on screen that they are examples.

## Self-review (after every render)
1. Watch it at real speed. One sentence per effect: what is the hero, what does it prove?
2. Any frame static for more than 3 frames? Any light pop or flicker?
3. Is the hero number readable on a phone? One hero per frame?
4. Does anything collide with the face, another card or the platform zones?
5. Are the numbers real? What would you still improve, in order of impact?
