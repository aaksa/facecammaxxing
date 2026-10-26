#!/usr/bin/env bash
# One-time setup for facecammaxxing. Safe to run again: it prints READY when everything is in place.
#   - a Python venv (.venv) with OpenCV, MediaPipe and ONNX Runtime for the tracking pass
#   - the three models (YuNet face, MediaPipe selfie, RobustVideoMatting) in models/
#   - the Remotion project's node_modules (Node 22+)
set -e
cd "$(dirname "$0")/.."

command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1 || { echo "NEED_FFMPEG: brew install ffmpeg"; exit 1; }

# python
if ! { [ -x .venv/bin/python ] && .venv/bin/python -c "import mediapipe, cv2, onnxruntime, PIL, numpy" 2>/dev/null; }; then
  if command -v uv >/dev/null 2>&1; then
    uv venv -q -p 3.11 .venv 2>/dev/null || uv venv -q -p 3.12 .venv
    UV_HTTP_TIMEOUT=120 uv pip install -q -p .venv/bin/python -r requirements.txt
  else
    PY=""; for v in python3.12 python3.11 python3.10; do command -v "$v" >/dev/null 2>&1 && { PY="$v"; break; }; done
    [ -n "$PY" ] || { echo "NEED_PYTHON: install Python 3.10-3.12 (MediaPipe has no wheels for newer ones yet), or uv"; exit 1; }
    "$PY" -m venv .venv && .venv/bin/python -m pip install -q --upgrade pip && .venv/bin/python -m pip install -q -r requirements.txt
  fi
fi

# models (from their official homes)
mkdir -p models
get() { [ -s "models/$1" ] || { echo "downloading $1"; curl -sSLf --retry 3 -o "models/$1.part" "$2" && mv "models/$1.part" "models/$1"; }; }
get yunet.onnx https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx
get selfie_segmenter.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
get rvm_mobilenetv3_fp32.onnx https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx \
  || echo "note: RobustVideoMatting did not download; the cut-out falls back to MediaPipe (softer hair)"

# node
NODE=""
for n in node "$HOME"/.nvm/versions/node/v2[2-9]*/bin/node; do
  command -v "$n" >/dev/null 2>&1 && "$n" -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' 2>/dev/null && { NODE="$n"; break; }
done
[ -n "$NODE" ] || { echo "NEED_NODE: install Node 22+ (https://nodejs.org or nvm install 22)"; exit 1; }
if [ ! -d remotion/node_modules/@remotion/renderer ]; then
  (cd remotion && PATH="$(dirname "$(command -v "$NODE")"):$PATH" npm install --no-audit --no-fund --loglevel=error)
fi

command -v blender >/dev/null 2>&1 || [ -n "${BLENDER:-}${BLENDER_PY:-}" ] || [ -x /Applications/Blender.app/Contents/MacOS/Blender ] \
  || echo "note: Blender not found; only new 3D props need it (fcm.py blender). The built-in props ship in props/."
.venv/bin/python -c "import mediapipe, cv2, onnxruntime, PIL, numpy" && echo READY
