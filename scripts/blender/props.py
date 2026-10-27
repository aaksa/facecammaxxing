"""Built-in props for `prop-3d`: literal objects for the claims creators make most.

  blender -b --factory-startup -P props.py -- <kind> <out.glb> [--color #hex]
  (or through the skill: fcm.py blender <job> <kind> [--color #hex] [--name <name>])

  trophy  the win            gold cup on a dark plinth
  clock   hours / time       wall clock; hand_hour and hand_minute turn (prop-3d `hours` sweeps them)
  coin    money / revenue    gold coin with a raised centre and rims
  phone   the app / real UI  phone with a `screen` plane that takes the creator's screenshot (prop-3d `image`)
  check   it works / yes     a chunky check mark in the accent colour
  x       rejection / no     a chunky red X, like a stamp

A prop of your own: copy template.py, build it with kit.py, and run it the same way (fcm.py blender <job> my_prop.py).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402


def trophy(color):
    dark = kit.material('plinth', kit.INK, roughness=0.32, coat=0.7)
    gold = kit.material('gold', color or kit.GOLD, metallic=1.0, roughness=0.22)
    kit.box('base', (0.17, 0.17, 0.045), dark, loc=(0, 0, 0.0225), bevel=0.006)
    kit.box('step', (0.115, 0.115, 0.03), dark, loc=(0, 0, 0.06), bevel=0.005)
    kit.lathe('stem', [(0, 0.075), (0.03, 0.075), (0.034, 0.082), (0.016, 0.1), (0.011, 0.135), (0.024, 0.15), (0, 0.152)], gold)
    kit.lathe('cup', [(0, 0.148), (0.028, 0.148), (0.05, 0.165), (0.072, 0.2), (0.088, 0.25), (0.096, 0.3), (0.099, 0.305),
                      (0.09, 0.305), (0.084, 0.26), (0.07, 0.215), (0.045, 0.19), (0, 0.185)], gold)
    for side in (-1, 1):
        kit.torus(f'handle_{"lr"[side > 0]}', 0.042, 0.009, gold, loc=(side * 0.092, 0, 0.245), rot=(math.pi / 2, 0, 0))


def clock(color):
    body = kit.material('body', color or kit.ORANGE, roughness=0.35, coat=0.8)
    face = kit.material('face', kit.PAPER, roughness=0.65)
    ink = kit.material('ink', kit.INK, roughness=0.4)
    kit.cylinder('body', 0.15, 0.05, body, facing='front', bevel=0.012)
    kit.cylinder('dial', 0.128, 0.004, face, loc=(0, -0.026, 0), facing='front')
    for i in range(12):
        a, big = 2 * math.pi * i / 12, i % 3 == 0
        t = kit.box(f'tick_{i}', (0.008 if big else 0.005, 0.004, 0.026 if big else 0.016), ink,
                    loc=(math.sin(a) * 0.108, -0.029, math.cos(a) * 0.108))
        t.rotation_euler = (0, a, 0)
    # both hands start at 12 with their origin on the centre, so the Three.js side turns them about the front axis
    h = kit.box('hand_hour', (0.011, 0.004, 0.068), ink, loc=(0, -0.032, 0.026), bevel=0.002)
    kit.pivot(h, (0, -0.032, 0))
    m = kit.box('hand_minute', (0.007, 0.004, 0.1), kit.material('hand', kit.ORANGE if color != kit.ORANGE else kit.INK, roughness=0.4),
                loc=(0, -0.036, 0.042), bevel=0.0015)
    kit.pivot(m, (0, -0.036, 0))
    kit.cylinder('cap', 0.009, 0.014, ink, loc=(0, -0.038, 0), facing='front')


def coin(color):
    gold = kit.material('gold', color or kit.GOLD, metallic=1.0, roughness=0.28)
    kit.cylinder('coin', 0.1, 0.018, gold, facing='front', bevel=0.003)
    kit.cylinder('relief', 0.066, 0.023, gold, facing='front', bevel=0.002)
    for y in (-0.009, 0.009):
        kit.torus(f'rim_{"fb"[y > 0]}', 0.088, 0.0035, gold, loc=(0, y, 0), rot=(math.pi / 2, 0, 0))


def phone(color):
    shell = kit.material('shell', color or kit.INK, roughness=0.3, coat=0.9)
    glass = kit.material('screen', '#0b0b0f', roughness=0.08, coat=1.0)
    kit.box('body', (0.075, 0.009, 0.155), shell, bevel=0.009, segments=6)
    kit.plane('screen', 0.068, 0.148, glass, loc=(0, -0.0047, 0))
    kit.box('camera', (0.024, 0.003, 0.024), shell, loc=(0.017, 0.0055, 0.058), bevel=0.005)


def check(color):
    mat = kit.material('mark', color or kit.ORANGE, roughness=0.35, coat=0.8)
    a = kit.box('mark_short', (0.05, 0.05, 0.13), mat, loc=(-0.06, 0, -0.02), bevel=0.012)
    a.rotation_euler = (0, -math.pi / 4, 0)
    b = kit.box('mark_long', (0.05, 0.05, 0.26), mat, loc=(0.035, 0, 0.03), bevel=0.012)
    b.rotation_euler = (0, math.pi / 5, 0)


def x(color):
    mat = kit.material('mark', color or '#E5484D', roughness=0.35, coat=0.8)
    for i, r in enumerate((math.pi / 4, -math.pi / 4)):
        o = kit.box(f'mark_{i}', (0.055, 0.05, 0.26), mat, bevel=0.012)
        o.rotation_euler = (0, r, 0)


KINDS = {'trophy': trophy, 'clock': clock, 'coin': coin, 'phone': phone, 'check': check, 'x': x}

if __name__ == '__main__':
    a = kit.args()
    color = a[a.index('--color') + 1] if '--color' in a else None
    pos = [v for i, v in enumerate(a) if not v.startswith('--') and (i == 0 or a[i - 1] != '--color')]
    if len(pos) < 2 or pos[0] not in KINDS:
        sys.exit(f'usage: props.py -- <{"|".join(KINDS)}> <out.glb> [--color #hex]')
    kit.reset()
    KINDS[pos[0]](color)
    kit.export(pos[1])
