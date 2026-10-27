#!/usr/bin/env python3
"""facecammaxxing: one entry point for the whole pipeline.

  fcm.py setup                                   install everything once (prints READY)
  fcm.py list                                    the effects and their options
  fcm.py track  <video> [<job-dir>] [--width 2160] [--matte mediapipe]
                                                 pass 1: cut-out, face path, clean room (default job: ./<video>_facecam)
  fcm.py words  <job-dir>                        word timings (words.json), for "when I say X"
  fcm.py check  <job-dir> <plan.json> --at 1.2,3.4 [--at-mid]
                                                 check stills + one contact sheet (look at it before rendering)
  fcm.py render <job-dir> <plan.json> [--out out.mp4] [--draft] [--range 0.5-3.5] [--intro]
                                                 the final MP4 (draft = half size, fast; range = only those seconds;
                                                 intro = open with ChatRender, also set by "intro" in the plan)
  fcm.py blender <job-dir> <prop|script.py> [--name <name>] [--color #hex]
                                                 model a 3D prop in headless Blender -> <job>/models/<name>.glb (for prop-3d)
"""
import glob, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = os.path.join(ROOT, '.venv', 'bin', 'python')
REMOTION = os.path.join(ROOT, 'remotion')
REGISTRY = os.path.join(REMOTION, 'src', 'effects', 'index.tsx')
GUIDE = os.path.join(REMOTION, 'src', 'effects', 'guide.tsx')


def node22():
    cands = [shutil.which('node')] + sorted(glob.glob(os.path.expanduser('~/.nvm/versions/node/v*/bin/node')), reverse=True)
    for n in cands:
        if not n: continue
        try:
            v = subprocess.run([n, '-p', 'process.versions.node'], capture_output=True, text=True).stdout.strip()
            if int(v.split('.')[0]) >= 22: return n
        except Exception: pass
    sys.exit('Node 22 or newer is needed (https://nodejs.org, or nvm install 22).')


def effects():
    """Read the effect names, descriptions, options and aliases straight from the Remotion registry."""
    files = [open(f).read() for f in sorted(glob.glob(os.path.join(REMOTION, 'src', 'effects', '*.tsx')))]
    src = open(REGISTRY).read()
    entry = r"'?([a-z0-9-]+)'?: \{\n\s+desc: '([^']*)',\n\s+options: '([^']*)'"
    consts = {m.group(1): (m.group(2), m.group(3)) for t in files for m in
              re.finditer(r"export const (\w+): FxDef = \{\n\s+desc: '([^']*)',\n\s+options: '([^']*)'", t)}
    fx = {}
    for t in [open(GUIDE).read(), src]:          # the order effects are registered in
        for m in re.finditer(r"^  (?:" + entry + r"|'?([a-z0-9-]+)'?: ([A-Z0-9_]+),)", t, re.M):
            if m.group(1): fx[m.group(1)] = (m.group(2), m.group(3))
            elif m.group(5) in consts: fx[m.group(4)] = consts[m.group(5)]
    al = dict(re.findall(r"'?([a-z0-9-]+)'?: '([a-z0-9-]+)'", src[src.index('export const ALIASES'):]))
    return fx, al


def load_plan(path, job):
    plan = json.load(open(path))
    if isinstance(plan, dict) and plan.get('outro'): return []        # the comment-keyword ending has no effects
    items = plan.get('effects', plan) if isinstance(plan, dict) else plan
    fx, al = effects()
    dur = json.load(open(os.path.join(job, 'track.json')))['duration']
    bad = []
    for e in items:
        name = al.get(e['fx'].lower().lstrip('/'), e['fx'].lower().lstrip('/'))
        if name not in fx: bad.append(e['fx'])
        if float(e.get('end', dur)) <= float(e.get('start', 0)): sys.exit(f"{e['fx']}: end must be after start")
        if float(e.get('start', 0)) >= dur: print(f"warning: {e['fx']} starts at {e['start']}s, after the clip ends ({dur:.2f}s)")
    if bad: sys.exit(f"Unknown effect(s): {', '.join(bad)}. Run `fcm.py list`.")
    return items


BLENDER_KIT = os.path.join(ROOT, 'scripts', 'blender')


def blender():
    """Blender to run headless: $BLENDER, then the usual install places; or $BLENDER_PY, a Python with the bpy module."""
    for b in [os.environ.get('BLENDER'), shutil.which('blender'), '/Applications/Blender.app/Contents/MacOS/Blender',
              os.path.expanduser('~/Applications/Blender.app/Contents/MacOS/Blender'), '/snap/bin/blender']:
        if b and os.path.exists(b): return [b, '-b', '--factory-startup', '-noaudio', '--python']
    if os.environ.get('BLENDER_PY'): return [os.environ['BLENDER_PY']]
    if shutil.which('flatpak') and subprocess.run(['flatpak', 'info', 'org.blender.Blender'], capture_output=True).returncode == 0:
        return ['flatpak', 'run', 'org.blender.Blender', '-b', '--factory-startup', '-noaudio', '--python']
    sys.exit('NEED_BLENDER: install Blender 3.6+ (brew install --cask blender, snap install blender --classic, or blender.org), '
             'or set BLENDER=/path/to/blender. A Python 3.11 with `pip install bpy` works too: BLENDER_PY=/path/to/python.\n'
             'The built-in props (trophy, clock, coin, phone, check, x) ship ready-made in props/, so prop-3d needs Blender only for new ones.')


def render(args):
    r = subprocess.run([node22(), os.path.join(REMOTION, 'render.mjs')] + args, cwd=REMOTION)
    if r.returncode: sys.exit(r.returncode)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'): print(__doc__); return
    cmd, rest = sys.argv[1], sys.argv[2:]
    valued = ('--at', '--out', '--width', '--matte', '--max-fps', '--concurrency', '--crf', '--range', '--name', '--color')
    flag = lambda k, d=None: rest[rest.index(k) + 1] if k in rest and rest.index(k) + 1 < len(rest) else d
    pos = [a for i, a in enumerate(rest) if not a.startswith('--') and (i == 0 or rest[i - 1] not in valued)]

    if cmd == 'setup':
        sys.exit(subprocess.run(['bash', os.path.join(ROOT, 'scripts', 'setup.sh')]).returncode)
    if cmd != 'blender' and (not os.path.exists(PY) or not os.path.isdir(os.path.join(REMOTION, 'node_modules'))):
        sys.exit('Not set up yet: run `fcm.py setup` first.')

    if cmd == 'list':
        fx, al = effects()
        for i, (k, (d, o)) in enumerate(fx.items()):
            print(f'{i + 1:2d}. {k:15s} {d}\n    options: {o}')
        print('\naliases: ' + ', '.join(f'{a} -> {b}' for a, b in al.items()))
    elif cmd == 'track':
        video = os.path.abspath(pos[0])
        job = os.path.abspath(pos[1]) if len(pos) > 1 else os.path.join(os.getcwd(), os.path.splitext(os.path.basename(video))[0] + '_facecam')
        extra = [x for k in ('--width', '--matte', '--max-fps') if flag(k) for x in (k, flag(k))]
        sys.exit(subprocess.run([PY, os.path.join(ROOT, 'scripts', 'track.py'), video, job] + extra).returncode)
    elif cmd == 'words':
        sys.exit(subprocess.run([PY, os.path.join(ROOT, 'scripts', 'words.py'), os.path.abspath(pos[0])]).returncode)
    elif cmd == 'check':
        job, plan = os.path.abspath(pos[0]), os.path.abspath(pos[1])
        items = load_plan(plan, job)
        at = flag('--at')
        if not at or '--at-mid' in rest:  # the middle of every effect, plus its first third (the entrance)
            ts = sorted({round(float(e['start']) + (float(e['end']) - float(e['start'])) * k, 2) for e in items for k in (0.3, 0.6)})
            at = ','.join(str(t) for t in ts)
        out = os.path.join(job, 'check', os.path.splitext(os.path.basename(plan))[0])
        shutil.rmtree(out, ignore_errors=True)
        raw = json.load(open(plan))
        if '--intro' in rest or (isinstance(raw, dict) and raw.get('intro')):   # the intro's beats: typing, sent, dots, grow
            at = ','.join(['i0.12', 'i0.3', 'i0.6', 'i1.02', 'i1.3', 'i1.6', 'i2.25'] + at.split(','))
        render(['--job', job, '--plan', plan, '--still', at, '--out-dir', out] + (['--intro'] if '--intro' in rest else []))
        order = lambda p: (lambda n: (0, float(n[6:])) if n.startswith('intro_') else (1, float(n)))(os.path.basename(p)[:-4])
        pngs = sorted(glob.glob(os.path.join(out, '*.png')), key=order)
        subprocess.run([PY, os.path.join(ROOT, 'scripts', 'sheet.py'), os.path.join(out, 'sheet.jpg')] + pngs + ['--cols', str(min(5, len(pngs)))], check=True)
    elif cmd == 'render':
        job, plan = os.path.abspath(pos[0]), os.path.abspath(pos[1])
        load_plan(plan, job)
        out = os.path.abspath(flag('--out') or os.path.join(job, os.path.splitext(os.path.basename(plan))[0] + ('_draft' if '--draft' in rest else '') + '.mp4'))
        render(['--job', job, '--plan', plan, '--out', out] + (['--scale', '0.5'] if '--draft' in rest else [])
               + [x for k in ('--concurrency', '--crf', '--range') if flag(k) for x in (k, flag(k))]
               + (['--intro'] if '--intro' in rest else []))
    elif cmd == 'blender':
        job, what = os.path.abspath(pos[0]), pos[1]
        script = os.path.abspath(what) if what.endswith('.py') else os.path.join(BLENDER_KIT, 'props.py')
        if not os.path.exists(script): sys.exit(f'no such script: {script}')
        name = flag('--name') or os.path.splitext(os.path.basename(what))[0]
        out = os.path.join(job, 'models', f'{name}.glb')
        extra = ['--color', flag('--color')] if flag('--color') else []
        argv = ([what] if not what.endswith('.py') else []) + [out] + extra
        r = subprocess.run(blender() + [script, '--'] + argv, env={**os.environ, 'FCM_BLENDER_KIT': BLENDER_KIT},
                           capture_output=True, text=True)
        log = (r.stdout + r.stderr).splitlines()
        if r.returncode or not os.path.exists(out):
            print('\n'.join(log[-25:])); sys.exit(r.returncode or 1)
        print('\n'.join(l for l in log if l.startswith('GLB ')))
        print(f'use it: {{"fx": "prop-3d", "model": "{name}", ...}}')
    else:
        sys.exit(f'unknown command {cmd!r}\n{__doc__}')


if __name__ == '__main__':
    main()
