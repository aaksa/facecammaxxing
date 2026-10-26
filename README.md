# facecammaxxing

Pro motion-graphics effects on your own talking-head clip, as a Claude Code skill. Remotion + Three.js + GSAP render the
effects over a clean cut-out of you (RobustVideoMatting), so words, cards and 3D rings sit **behind your head** or float in
front of you, track your face, and stay out of the Reels UI.

```bash
bash install.sh                                   # link into ~/.claude/skills/facecammaxxing
.venv/bin/python scripts/fcm.py setup             # venv, models, Remotion (prints READY)
.venv/bin/python scripts/fcm.py track clip.mp4 job
.venv/bin/python scripts/fcm.py check job plan.json
.venv/bin/python scripts/fcm.py render job plan.json --out final.mp4
```

Six core effects: `over-the-shoulder`, `kallaway-split`, `freeze-frame`, `tier-list`, `text-behind`, `color-grade`; plus
`glass-graph`, `carousel-spin`, `orbit`, `glass-widgets`, `spotlight`, `backdrop-word`, `slow-push`, `lean-in`, `grade`, `locked-on`; hook effects `kinetic-caption`, `window-cards`, `name-tag`, `silhouette-intro`, `bottom-fade`.
See `SKILL.md` for the workflow and `docs/motion-rules.md` for the motion and layout rules every effect follows.

Needs: macOS or Linux, ffmpeg, Python 3.10-3.12 (or uv), Node 22+.
