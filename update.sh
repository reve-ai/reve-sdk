#!/usr/bin/env bash
set -euo pipefail

if [ -z "${REVE_SDK_DIR:-}" ]; then
	echo "Error: REVE_SDK_DIR is not set -- should point to Reve internal python sdk dir" >&2
	echo "It will typically be HOME/reve-core/sdk" >&2
	exit 1
fi
if [ ! -f "${REVE_SDK_DIR}/python/publish.sh" ] || [ ! -f "${REVE_SDK_DIR}/web-sdk/publish.sh" ]; then
	echo "Error: REVE_SDK_DIR does not seem to be accurate: ${REVE_SDK_DIR}" >&2
	echo "It will typically be HOME/reve-core/sdk" >&2
	exit 1
fi

DST="$(cd "$(dirname "$0")" && pwd)"

cd "$DST"
git pull -r origin main

rsync -avh "$REVE_SDK_DIR/" "$DST/"

git add -A
auggie --print 'Commit all the changes with a brief commit message explaining what changes the user will see. Do not focus on code, focus on a brief summary of visible changes. If the changes are already committed, update the commit message to include the formulated message.'
git push origin main
