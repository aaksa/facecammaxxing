#!/usr/bin/env python3
"""Find when each word is said, so an effect can land on the right word.

usage: words.py <job-dir | video>   -> prints "12.34  word" lines and saves words.json in the job (or next to the video)
Uses mlx-whisper on Apple silicon when it is installed, else faster-whisper (installed into the skill's .venv on first use).
Set WHISPER_MODEL (default: base for faster-whisper) and WHISPER_LANG (e.g. id, en) to override.
"""
import json, os, subprocess, sys

arg = os.path.abspath(sys.argv[1])
src = os.path.join(arg, 'source.mp4') if os.path.isdir(arg) else arg
out = os.path.join(arg, 'words.json') if os.path.isdir(arg) else os.path.splitext(src)[0] + '.words.json'
has_audio = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', src],
                           capture_output=True, text=True).stdout.strip()
if not has_audio:
    sys.exit(f'{os.path.basename(src)} has no audio track, so there are no words to time. Use seconds in the plan instead.')
lang = os.environ.get('WHISPER_LANG') or None
words = []
try:
    import mlx_whisper
    r = mlx_whisper.transcribe(src, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', word_timestamps=True, language=lang)
    words = [{'w': w['word'].strip(), 's': round(w['start'], 2), 'e': round(w['end'], 2)} for seg in r['segments'] for w in seg.get('words', [])]
except ImportError:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print('Installing the transcriber (one time, about 1 minute)...', flush=True)
        try: subprocess.run(['uv', 'pip', 'install', '-q', '-p', sys.executable, 'faster-whisper'], check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'faster-whisper'], check=True)
        from faster_whisper import WhisperModel
    model = WhisperModel(os.environ.get('WHISPER_MODEL', 'base'), device='cpu', compute_type='int8')
    segs, _ = model.transcribe(src, word_timestamps=True, vad_filter=True, language=lang)
    words = [{'w': w.word.strip(), 's': round(w.start, 2), 'e': round(w.end, 2)} for s in segs for w in (s.words or [])]

json.dump(words, open(out, 'w'), indent=0)
for w in words: print(f"{w['s']:7.2f}  {w['w']}")
print(f'\nSaved {len(words)} words to {out}')
