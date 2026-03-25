#!/usr/bin/env bash
set -euo pipefail

# Build and publish the Reve Python SDK to PyPI.
# Requires: pip install build twine

cd "$(dirname "$0")"

echo "Cleaning previous builds..."
rm -rf dist/ build/ ./*.egg-info reve/*.egg-info

echo "Incrementing version number"
python increment_version.py

echo "Building package..."
python -m build

echo "Uploading to PyPI..."
twine upload dist/*

echo "Done!"
