#!/usr/bin/env bash
# install.sh - link (or copy) this folder into the Claude Code skills directory, then run setup.
# Usage:  bash install.sh [--dir ~/.claude/skills/facecammaxxing] [--copy] [--force]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.claude/skills/facecammaxxing"; COPY=0; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) TARGET="${2:?--dir needs a path}"; shift 2;;
    --copy) COPY=1; shift;;
    --force) FORCE=1; shift;;
    -h|--help) sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "unknown option: $1" >&2; exit 2;;
  esac
done
if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  if [ -L "$TARGET" ] && [ "$(readlink "$TARGET")" = "$HERE" ]; then echo "Already linked: $TARGET -> $HERE"
  else
    [ "$FORCE" = 1 ] || { echo "$TARGET already exists. Re-run with --force to replace it." >&2; exit 1; }
    rm -rf "${TARGET:?}"
  fi
fi
mkdir -p "$(dirname "$TARGET")"
if [ ! -e "$TARGET" ]; then
  if [ "$COPY" = 1 ]; then
    mkdir -p "$TARGET"; (cd "$HERE" && tar --exclude=.git --exclude=node_modules --exclude=.venv --exclude=demo -cf - .) | (cd "$TARGET" && tar -xf -)
    echo "Copied to $TARGET"
  else
    ln -s "$HERE" "$TARGET"; echo "Linked $TARGET -> $HERE"
  fi
fi
bash "$TARGET/scripts/setup.sh"
echo "Done. In Claude Code, give it a talking-head clip and ask for an effect, or say facecam maxxing."
