#!/usr/bin/env bash
set -euo pipefail

if [ -z "${REVE_SDK_DIR:-}" ]; then
	echo "Error: REVE_SDK_DIR is not set" >&2
	exit 1
fi
if [ ! -f "${REVE_SDK_DIR}/update.sh" ] || [ ! -d "${REVE_SDK_DIR}/skills" ]; then
	echo "Error: REVE_SDK_DIR does not seem to be accurate: ${REVE_SDK_DIR}"
	exit 1
fi

SRC="$(cd "$(dirname "$0")" && pwd)"

cd "$REVE_SDK_DIR"
git pull -r origin main

rsync -avh "$SRC/" "$REVE_SDK_DIR/"

git add -A
auggie --print 'Commit all the changes with a brief commit message explaining what changes the user will see. Do not focus on code, focus on a brief summary of visible changes'
git push origin main
