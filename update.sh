#!/usr/bin/env bash
set -euo pipefail

if [ -z "${REVE_SDK_DIR:-}" ]; then
	echo "Error: REVE_SDK_DIR is not set" >&2
	exit 1
fi

SRC="$(cd "$(dirname "$0")" && pwd)"

cd "$REVE_SDK_DIR"
git pull -r origin main

rsync -avh "$SRC/" "$REVE_SDK_DIR/"

git add -A
git commit -m "Changes $(date)"
git push origin main
