# facecammaxxing

Pro motion-graphics effects on your own talking-head clip, as a Claude Code skill. Remotion + GSAP + Three.js render the
effects over a clean cut-out of you (RobustVideoMatting), so words, cards, 3D rings and Blender-modelled props sit **behind your
head** or float in front of you, track your face, and stay out of the Reels UI. It works like an award-level reel director:
brief, one idea per sentence, a beat plan, the hardest beat first, and a measured self-review (`docs/director.md`).

```bash
bash install.sh                                   # link into ~/.claude/skills/facecammaxxing
.venv/bin/python scripts/fcm.py setup             # venv, models, Remotion (prints READY)
.venv/bin/python scripts/fcm.py track clip.mp4 job
.venv/bin/python scripts/fcm.py check job plan.json
.venv/bin/python scripts/fcm.py render job plan.json --out final.mp4
.venv/bin/python scripts/fcm.py blender job my_prop.py --name mic   # optional: model a 3D prop in headless Blender
```

Six core effects: `over-the-shoulder`, `kallaway-split`, `freeze-frame`, `tier-list`, `text-behind`, `color-grade`; plus
`prop-3d` (Blender GLB props: trophy, clock, coin, phone, check, x, or your own); `glass-graph`, `carousel-spin`, `orbit`, `glass-widgets`, `spotlight`, `backdrop-word`, `slow-push`, `lean-in`, `grade`, `locked-on`; hook effects `kinetic-caption`, `window-cards`, `name-tag`, `silhouette-intro`, `bottom-fade`.
See `SKILL.md` for the workflow, `docs/director.md` for how to direct it and `docs/motion-rules.md` for the motion and layout
rules every effect follows.

Needs: macOS or Linux, ffmpeg, Python 3.10-3.12 (or uv), Node 22+. Optional: Blender 3.6+ (or `pip install bpy` on Python 3.11)
for new 3D props; the built-in ones ship in `props/`.
