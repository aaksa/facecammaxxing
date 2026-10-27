#!/usr/bin/env bash
# The full reel: six effects, each opened by its ChatRender beat, then the comment-keyword outro. Hard cuts between them.
set -e
R=${R:-$PWD}; J=${J:?set J to the job dir from fcm.py track}
S="$(cd "$(dirname "$0")/../.." && pwd)"; PY=$S/.venv/bin/python; F=$S/scripts/fcm.py
cd $R; : > list.txt
while read -r name a b; do
  [ -n "$name" ] || continue
  [ -s "$name.mp4" ] && [ "${FORCE:-0}" != 1 ] || $PY $F render $J $name.json --out $R/$name.mp4 --range $a-$b | grep -E "Done|rror"
  echo "file '$R/$name.mp4'" >> list.txt
done < segments.txt
$PY $F render $J 7_outro.json --out $R/7_outro.mp4 | grep -E "Done|rror"
echo "file '$R/7_outro.mp4'" >> list.txt
ffmpeg -v error -y -f concat -safe 0 -i list.txt -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p -r 30000/1001 -movflags +faststart $R/facecam_reel.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 $R/facecam_reel.mp4
# background music (optional): MUSIC=<file> MUSIC_AT=<seconds into the track, on a beat>; fades out over the last 0.5 s,
# levelled to -14 LUFS (two-pass loudnorm)
if [ -n "${MUSIC:-}" ]; then
  OUT=$(ls -t "$R"/../facecam_reel.mp4 "$R"/facecam_reel.mp4 2>/dev/null | head -1); D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
  AF="atrim=0:$D,asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=$(python3 -c "print(round($D-0.5,3))"):d=0.5"
  J=$(ffmpeg -hide_banner -ss "${MUSIC_AT:-0}" -i "$MUSIC" -af "$AF,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  g(){ echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
  ffmpeg -v error -y -i "$OUT" -ss "${MUSIC_AT:-0}" -i "$MUSIC" -map 0:v -map 1:a -c:v copy \
    -af "$AF,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" \
    -c:a aac -b:a 256k -ar 48000 -t "$D" -movflags +faststart "${OUT%.mp4}_music.mp4"
  echo "with music: ${OUT%.mp4}_music.mp4"
fi
