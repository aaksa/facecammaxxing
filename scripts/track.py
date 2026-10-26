#!/usr/bin/env python3
"""Pass 1 of facecammaxxing: turn a talking-head clip into the layers the Remotion comp needs.

usage: track.py <video> <job-dir> [--width 1080] [--matte auto|rvm|mediapipe] [--max-fps 30]

Writes into <job-dir> (it becomes Remotion's public dir):
  source.mp4    the clip as 8-bit H.264 at the output size (audio kept)
  person.webm   you cut out, VP9 with alpha
  room.mp4      the room with you removed (static camera only), for parallax moves
  plate.jpg     the clean background plate (static camera only)
  track.json    fps, size, duration, smoothed face path, head top, camera-static flag
  thumbs/       10 frames of the clip, the default cards for carousel / orbit
"""
import argparse, json, math, os, subprocess, sys, time
import numpy as np
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, 'models')


def run(cmd): return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout


def probe(path):
    j = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                        'stream=width,height,r_frame_rate,color_transfer:stream_side_data=rotation:format=duration', '-of', 'json', path]))
    s = j['streams'][0]; num, den = s['r_frame_rate'].split('/')
    rot = 0
    for sd in s.get('side_data_list', []) or []:
        if 'rotation' in sd: rot = int(sd['rotation'])
    w, h = s['width'], s['height']
    if abs(rot) in (90, 270): w, h = h, w
    has_audio = bool(run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path]).strip())
    return float(num) / float(den or 1), s['r_frame_rate'], float(j['format']['duration']), w, h, s.get('color_transfer', ''), has_audio


def read_frames(path, W, H, fr, fmt='rgb24', ch=3):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={fr},scale={W}:{H}:flags=lanczos,format={fmt}', '-f', 'rawvideo', '-'],
                         stdout=subprocess.PIPE, bufsize=10 ** 8)
    n = W * H * ch
    try:
        while True:
            b = p.stdout.read(n)
            if len(b) < n: break
            yield np.frombuffer(b, np.uint8).reshape(H, W, ch) if ch > 1 else np.frombuffer(b, np.uint8).reshape(H, W)
    finally:
        if p.poll() is None: p.kill()
        p.stdout.close(); p.wait()


def writer(path, W, H, fr, pix_in, args):
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', pix_in, '-s', f'{W}x{H}', '-r', fr, '-i', '-'] + args + [path],
                            stdin=subprocess.PIPE)


# ---------- matting ----------
class RVM:
    """RobustVideoMatting (MobileNetV3, ONNX). Recurrent, so it is run frame by frame in order."""
    name = 'rvm'

    def __init__(self, W, H):
        import onnxruntime as ort
        self.s = ort.InferenceSession(os.path.join(MODELS, 'rvm_mobilenetv3_fp32.onnx'), providers=['CPUExecutionProvider'])
        self.rec = [np.zeros([1, 1, 1, 1], np.float32)] * 4
        self.dr = np.array([0.25 if max(W, H) <= 2000 else 0.125], np.float32)

    def __call__(self, rgb, ms):
        src = (rgb.astype(np.float32) / 255).transpose(2, 0, 1)[None]
        fgr, pha, *self.rec = self.s.run(None, {'src': src, 'r1i': self.rec[0], 'r2i': self.rec[1], 'r3i': self.rec[2], 'r4i': self.rec[3],
                                                'downsample_ratio': self.dr})
        return pha[0, 0], (fgr[0].transpose(1, 2, 0) * 255).clip(0, 255).astype(np.uint8)


def guided(I, p, r=8, eps=2e-3):
    box = lambda x: cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))
    mI, mp_ = box(I), box(p); a = (box(I * p) - mI * mp_) / (box(I * I) - mI * mI + eps); b = mp_ - a * mI
    return np.clip(box(a) * I + box(b), 0, 1)


class MediaPipeMatte:
    """MediaPipe Selfie Segmenter (256 px) refined with a guided filter. Softer hair, but no extra model licence."""
    name = 'mediapipe'

    def __init__(self, W, H):
        import mediapipe as mp
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.core.base_options import BaseOptions
        self.mp = mp; self.prev = None
        self.seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
            base_options=BaseOptions(model_asset_path=os.path.join(MODELS, 'selfie_segmenter.tflite')),
            running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True, output_category_mask=False))

    def __call__(self, rgb, ms):
        img = self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
        m = self.seg.segment_for_video(img, ms).confidence_masks[-1].numpy_view().astype(np.float32)
        m = cv2.resize(m.reshape(m.shape[0], m.shape[1]), (rgb.shape[1], rgb.shape[0]))
        m = guided(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255, m)
        m = np.clip((m - 0.5) * 1.6 + 0.5, 0, 1)
        if self.prev is not None: m = 0.65 * m + 0.35 * self.prev
        self.prev = m
        return m, rgb


# ---------- face ----------
def smooth(vals, fps, tau=0.18):
    """Fill gaps, then a forward and a backward exponential pass, so the path is smooth and has no lag."""
    idx = [i for i, v in enumerate(vals) if v is not None]
    if not idx: return None
    k = len(vals[idx[0]])
    arr = np.array([vals[i] if vals[i] is not None else (np.nan,) * k for i in range(len(vals))], np.float64)
    for c in range(k):
        col = arr[:, c]; good = ~np.isnan(col)
        col[~good] = np.interp(np.where(~good)[0], np.where(good)[0], col[good]); arr[:, c] = col
    a = 1 - math.exp(-1 / (fps * tau))
    for i in range(1, len(arr)): arr[i] = arr[i - 1] + a * (arr[i] - arr[i - 1])
    for i in range(len(arr) - 2, -1, -1): arr[i] = arr[i + 1] + a * (arr[i] - arr[i + 1])
    return arr


def face_from(fd, small, m_small):
    _, f = fd.detect(cv2.cvtColor(small, cv2.COLOR_RGB2BGR))
    face = None
    if f is not None and len(f):
        r = max(f, key=lambda r: r[2] * r[3] * r[-1])
        face = (r[0] + r[2] / 2, r[1] + r[3] / 2, r[2])
    else:  # no face (turned away, motion blur): guess it from the top of the person mask
        rows = np.where((m_small > 0.5).sum(1) > m_small.shape[1] * 0.01)[0]
        if len(rows):
            top = rows[0]; band = m_small[top:top + max(4, int(m_small.shape[0] * 0.06))] > 0.5; xs = np.where(band.any(0))[0]
            fw = max(8.0, (xs.max() - xs.min()) * 0.8); face = (float(xs.mean()), top + fw * 0.7, fw)
    top = None
    if face is not None:
        x0 = int(max(0, face[0] - face[2] * 0.4)); x1 = int(min(m_small.shape[1], face[0] + face[2] * 0.4))
        rows = np.where((m_small[:, x0:x1] > 0.5).any(1))[0]
        if len(rows): top = float(rows[0])
    return face, top


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video'); ap.add_argument('job')
    ap.add_argument('--width', type=int, default=1080, help='short side of the output (1080, or 2160 for 4K)')
    ap.add_argument('--matte', default='auto', choices=['auto', 'rvm', 'mediapipe'])
    ap.add_argument('--max-fps', type=float, default=30)
    a = ap.parse_args()
    t0 = time.time()
    job = os.path.abspath(a.job); os.makedirs(os.path.join(job, 'thumbs'), exist_ok=True)
    fps_in, fr_in, dur, sw, sh, trc, has_audio = probe(a.video)
    fr = fr_in if fps_in <= a.max_fps + 0.5 else str(int(a.max_fps)); fps = min(fps_in, a.max_fps)
    if sw <= sh: W = a.width; H = int(round(a.width * sh / sw / 2)) * 2
    else: H = a.width; W = int(round(a.width * sw / sh / 2)) * 2
    tm = []
    if trc in ('arib-std-b67', 'smpte2084'):  # HLG / PQ footage: tone-map to SDR so it matches everything else
        tm = ['-vf', f'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,fps={fr},scale={W}:{H}:flags=lanczos,format=yuv420p']
    print(f'{os.path.basename(a.video)}: {sw}x{sh} {fps:.3f} fps {dur:.2f}s -> {W}x{H}', flush=True)

    # 1. the clip itself, as plain 8-bit H.264 at the output size (Remotion decodes it fast and reliably)
    src = os.path.join(job, 'source.mp4')
    run(['ffmpeg', '-v', 'error', '-y', '-i', a.video] + (tm or ['-vf', f'fps={fr},scale={W}:{H}:flags=lanczos,format=yuv420p']) +
        ['-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-g', '15', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
         '-colorspace', 'bt709'] + (['-c:a', 'aac', '-b:a', '192k'] if has_audio else ['-an']) + ['-movflags', '+faststart', src])
    print(f'  source.mp4 ({time.time() - t0:.0f}s)', flush=True)

    # 2. matte + face, frame by frame in order
    use = a.matte
    if use == 'auto': use = 'rvm' if os.path.exists(os.path.join(MODELS, 'rvm_mobilenetv3_fp32.onnx')) else 'mediapipe'
    matte = (RVM if use == 'rvm' else MediaPipeMatte)(W, H)
    aw = 540 if W <= H else int(round(540 * W / H / 2)) * 2; ah = int(round(aw * H / W / 2)) * 2; sc = W / aw
    fd = cv2.FaceDetectorYN.create(os.path.join(MODELS, 'yunet.onnx'), '', (aw, ah), 0.6, 0.3, 20)
    pw = writer(os.path.join(job, 'person.webm'), W, H, fr, 'rgba',
                ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-b:v', '0', '-crf', '18', '-deadline', 'good',
                 '-cpu-used', '4', '-row-mt', '1', '-an'])
    mw = writer(os.path.join(job, 'matte.mkv'), W, H, fr, 'gray', ['-c:v', 'ffv1', '-level', '3'])
    faces, tops, samples, bg_diff, first = [], [], [], [], None
    total = max(1, int(dur * fps)); n_thumb = 10; thumb_at = {int(total * (j + 0.5) / n_thumb) for j in range(n_thumb)}
    step = max(1, total // 48)
    for i, rgb in enumerate(read_frames(src, W, H, fr)):
        pha, fgr = matte(rgb, int(i / fps * 1000))
        # inside the body use the real pixels; on soft edges (hair) use the matte's de-spilled foreground colour
        col = np.where(pha[..., None] > 0.985, rgb, fgr)
        pw.stdin.write(np.dstack([col, (pha * 255 + 0.5).astype(np.uint8)]).tobytes())
        m8 = (pha * 255 + 0.5).astype(np.uint8); mw.stdin.write(m8.tobytes())
        small = cv2.resize(rgb, (aw, ah), interpolation=cv2.INTER_AREA); ms = cv2.resize(pha, (aw, ah), interpolation=cv2.INTER_AREA)
        f, top = face_from(fd, small, ms)
        faces.append(None if f is None else (f[0] / aw, f[1] / ah, f[2] / aw)); tops.append(None if top is None else (top / ah,))
        if i in thumb_at: cv2.imwrite(os.path.join(job, 'thumbs', f'{len(os.listdir(os.path.join(job, "thumbs"))):02d}.jpg'),
                                      cv2.cvtColor(small, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
        # is the camera still? measure how far the background shifted since the first frame
        # (phase correlation, so auto-exposure drift does not count as movement)
        g = cv2.cvtColor(small, cv2.COLOR_RGB2GRAY).astype(np.float32)
        bgm = cv2.dilate((ms > 0.05).astype(np.uint8), np.ones((15, 15), np.uint8)) == 0
        if first is None: first, first_bg = g, bgm
        elif i % 3 == 0:
            win = (bgm & first_bg).astype(np.float32)
            if win.mean() > 0.1:
                (dx, dy), _ = cv2.phaseCorrelate(first * win, g * win); bg_diff.append(math.hypot(dx, dy))
        if i % step == 0: samples.append((small, bgm))
        if i % int(fps * 2) == 0: print(f'  matte+face {i / fps:5.1f}s / {dur:.1f}s', flush=True)
    pw.stdin.close(); mw.stdin.close(); pw.wait(); mw.wait()
    n = len(faces)
    print(f'  person.webm via {use} ({time.time() - t0:.0f}s)', flush=True)

    sm = smooth(faces, fps)
    if sm is None: sm = np.tile([0.5, 0.33, 0.28], (n, 1))
    st = smooth(tops, fps, 0.12)
    if st is None: st = (sm[:, 1:2] - sm[:, 2:3] * 0.9 * W / H)
    static = bool(bg_diff) and float(np.percentile(bg_diff, 90)) < 1.0  # px at 540 wide
    # how light is the room around your head? (effects pick dark or light ink from this)
    s0, b0 = samples[len(samples) // 2]; band = b0.copy(); band[int(ah * 0.5):] = False
    bg_luma = float(cv2.cvtColor(s0, cv2.COLOR_RGB2GRAY)[band].mean() / 255) if band.any() else 0.5

    # 3. clean plate + room without you (static camera only): median of the background where you were not, inpaint the rest
    if static:
        stack = np.stack([s for s, _ in samples]).astype(np.float32)
        valid = np.stack([b for _, b in samples])
        stack[~valid] = np.nan
        with np.errstate(all='ignore'): plate = np.nanmedian(stack, axis=0)
        hole = np.isnan(plate[..., 0]).astype(np.uint8)
        plate = np.nan_to_num(plate).clip(0, 255).astype(np.uint8)
        if hole.any(): plate = cv2.inpaint(plate, cv2.dilate(hole, np.ones((5, 5), np.uint8)), 12, cv2.INPAINT_TELEA)
        plate = cv2.resize(plate, (W, H), interpolation=cv2.INTER_CUBIC)
        plate = cv2.GaussianBlur(plate, (0, 0), 1.2)
        cv2.imwrite(os.path.join(job, 'plate.jpg'), cv2.cvtColor(plate, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 94])
        rw = writer(os.path.join(job, 'room.mp4'), W, H, fr, 'rgb24', ['-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an'])
        pf = plate.astype(np.float32); k = np.ones((25, 25), np.uint8)
        for rgb, m8 in zip(read_frames(src, W, H, fr), read_frames(os.path.join(job, 'matte.mkv'), W, H, fr, 'gray', 1)):
            md = cv2.GaussianBlur(cv2.dilate(m8, k), (0, 0), 6).astype(np.float32)[..., None] / 255
            rw.stdin.write((rgb * (1 - md) + pf * md).astype(np.uint8).tobytes())
        rw.stdin.close(); rw.wait()
        print(f'  room.mp4 + plate.jpg ({time.time() - t0:.0f}s)', flush=True)
    else:
        for f in ('room.mp4', 'plate.jpg'):
            if os.path.exists(os.path.join(job, f)): os.remove(os.path.join(job, f))
        print('  camera moves: no clean plate, parallax effects fall back to flat moves', flush=True)

    r = lambda v: round(float(v), 4)
    json.dump({'fps': fps, 'fr': fr, 'width': W, 'height': H, 'frames': n, 'duration': n / fps, 'static': static, 'matte': use,
               'audio': has_audio, 'bg_luma': round(bg_luma, 3), 'source': os.path.abspath(a.video),
               'face': [[r(x), r(y), r(w)] for x, y, w in sm], 'top': [r(v[0]) for v in st]},
              open(os.path.join(job, 'track.json'), 'w'))
    print(f'Done in {time.time() - t0:.0f}s: {job} ({n} frames, camera {"static" if static else "moving"})', flush=True)


if __name__ == '__main__':
    main()
