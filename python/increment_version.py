#!/usr/bin/env python3
"""Increment the patch version in pyproject.toml if it hasn't been modified."""

import re
import subprocess
import sys
from pathlib import Path

NUM_SEMVER_PIECES = 3


def is_dirty(filepath: Path) -> bool:
    """Check if the file has uncommitted changes in git."""
    result = subprocess.run(
        ["git", "diff", "--name-only", str(filepath)],
        check=False,
        capture_output=True,
        text=True,
    )
    staged = subprocess.run(
        ["git", "diff", "--staged", "--name-only", str(filepath)],
        check=False,
        capture_output=True,
        text=True,
    )
    return bool(result.stdout.strip() or staged.stdout.strip())


def increment_patch(version: str) -> str:
    """Increment the patch component of a version string."""
    parts = version.split(".")
    if len(parts) != NUM_SEMVER_PIECES:
        raise ValueError(f"Expected semver with {NUM_SEMVER_PIECES} parts, got: {version}")
    parts[2] = str(int(parts[2]) + 1)
    return ".".join(parts)


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    pyproject = script_dir / "pyproject.toml"

    if not pyproject.exists():
        print(f"Error: {pyproject} not found", file=sys.stderr)
        sys.exit(1)

    if is_dirty(pyproject):
        print(f"{pyproject.name} is already modified, skipping version increment.")
        sys.exit(0)

    content = pyproject.read_text()
    match = re.search(r'^version\s*=\s*"([^"]+)"', content, re.MULTILINE)
    if not match:
        print("Error: could not find version in pyproject.toml", file=sys.stderr)
        sys.exit(1)

    old_version = match.group(1)
    new_version = increment_patch(old_version)
    new_content = content[: match.start(1)] + new_version + content[match.end(1) :]
    pyproject.write_text(new_content)
    print(f"Version incremented: {old_version} -> {new_version}")


if __name__ == "__main__":
    main()
