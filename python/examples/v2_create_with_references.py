"""Example: Generate or edit with ordered v2 image references.

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"

Usage:
    python v2_create_with_references.py path/to/original.jpg [path/to/reference.jpg]
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v2.image import create


def main():
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    paths = sys.argv[1:] or ["original.jpg"]
    missing = [path for path in paths if not os.path.isfile(path)]
    if missing:
        print(f"Image not found: {missing[0]}")
        sys.exit(1)

    try:
        print(f"Creating from {len(paths)} ordered reference image(s) …")
        result = create(
            prompt="Make the sky more dramatic with storm clouds",
            references=paths,
        )
        result.save("v2_with_references.jpg")
        print("Saved v2_with_references.jpg")
        print(f"  request_id={result.request_id}  credits_used={result.credits_used}")
    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
