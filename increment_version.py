#!/usr/bin/env python3
"""Increment the patch version in pyproject.toml and sync reve/_version.py to it."""

import re
import subprocess
import sys
from pathlib import Path

NUM_SEMVER_PIECES = 3

_PYPROJECT_VERSION_RE = re.compile(r'^version\s*=\s*"([^"]+)"', re.MULTILINE)
_MODULE_VERSION_RE = re.compile(r'^__version__\s*=\s*"([^"]+)"', re.MULTILINE)


def replace_version(path: Path, pattern: re.Pattern[str], new_version: str) -> str:
    """Rewrite the version captured by ``pattern`` in ``path``; return the old version."""
    content = path.read_text()
    match = pattern.search(content)
    if not match:
        print(f"Error: could not find version in {path}", file=sys.stderr)
        sys.exit(1)
    path.write_text(content[: match.start(1)] + new_version + content[match.end(1) :])
    return match.group(1)


def sync_version_module(script_dir: Path, version: str) -> None:
    """Make reve/_version.py report the same version as pyproject.toml."""
    version_module = script_dir / "reve" / "_version.py"
    old_version = replace_version(version_module, _MODULE_VERSION_RE, version)
    if old_version != version:
        print(f"Synced {version_module.name}: {old_version} -> {version}")


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

    match = _PYPROJECT_VERSION_RE.search(pyproject.read_text())
    if not match:
        print("Error: could not find version in pyproject.toml", file=sys.stderr)
        sys.exit(1)
    version = match.group(1)

    if is_dirty(pyproject):
        print(f"{pyproject.name} is already modified, skipping version increment.")
    else:
        version = increment_patch(version)
        replace_version(pyproject, _PYPROJECT_VERSION_RE, version)
        print(f"Version incremented: {match.group(1)} -> {version}")

    sync_version_module(script_dir, version)


if __name__ == "__main__":
    main()
