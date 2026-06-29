#!/usr/bin/env bash
set -euo pipefail

# Build and publish the Reve Python SDK to PyPI.
# Requires: pip install build twine

cd "$(dirname "$0")"

echo "Cleaning previous builds..."
rm -rf dist/ build/ ./*.egg-info reve/*.egg-info

echo "Incrementing version number"
uv run python increment_version.py

echo "Building package..."
uv run python -m build

echo "Uploading to PyPI..."
uv run twine upload dist/*

echo "Done!"
