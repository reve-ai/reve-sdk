#!/usr/bin/env bash
set -euo pipefail

# Build and publish the Reve web SDK to npmjs.
#
# Credentials: set NPM_TOKEN in the environment, or the script will run
# `npm login` interactively so you can authenticate in the browser.
#
# Version bump: if package.json has no uncommitted changes the patch version
# is incremented automatically (mirrors sdk/python/publish.sh behaviour).

cd "$(dirname "$0")"

# ---------------------------------------------------------------------------
# 1. Version bump (skip if package.json is already modified)
# ---------------------------------------------------------------------------
pkg_dirty() {
	git diff --name-only package.json | grep -q . \
		|| git diff --staged --name-only package.json | grep -q .
}

current_version() {
	node -e "process.stdout.write(require('./package.json').version)"
}

increment_patch() {
	local version="$1"
	local major minor patch
	IFS='.' read -r major minor patch <<< "$version"
	echo "${major}.${minor}.$((patch + 1))"
}

if pkg_dirty; then
	echo "package.json is already modified; skipping version increment."
	VERSION="$(current_version)"
else
	OLD_VERSION="$(current_version)"
	VERSION="$(increment_patch "$OLD_VERSION")"
	# Rewrite the "version" field in package.json in-place.
	node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, '\t') + '\n');
"
	echo "Version incremented: ${OLD_VERSION} -> ${VERSION}"
fi

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
echo "Building package..."
# Use rushx so the monorepo toolchain (pnpm, tsconfig paths) is in scope.
rushx build

# ---------------------------------------------------------------------------
# 3. Authenticate
# ---------------------------------------------------------------------------
if [[ -n "${NPM_TOKEN:-}" ]]; then
	# Write a temporary .npmrc that is cleaned up on exit.
	NPMRC="$(pwd)/.npmrc.publish"
	echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > "$NPMRC"
	trap 'rm -f "$NPMRC"' EXIT
	PUBLISH_ARGS=(--userconfig "$NPMRC")
else
	echo "NPM_TOKEN not set; running 'npm login' interactively."
	npm login
	PUBLISH_ARGS=()
fi

# ---------------------------------------------------------------------------
# 4. Publish
# ---------------------------------------------------------------------------
echo "Publishing @reve-ai/web-sdk@${VERSION} to npmjs..."
npm publish --access public "${PUBLISH_ARGS[@]}"

echo "Done! Remember to commit package.json with the new version."
