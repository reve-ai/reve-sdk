"""Example: Edit an existing image with a natural-language instruction.

The edit function takes a source image and a plain-English instruction
describing the desired change.

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"

Usage:
    python edit_image.py path/to/original.jpg
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v1.image import edit


def main():
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    src_path = sys.argv[1] if len(sys.argv) > 1 else "original.jpg"
    if not os.path.isfile(src_path):
        print(f"Source image not found: {src_path}")
        sys.exit(1)

    try:
        print(f"Editing image: {src_path}")
        img = edit(
            edit_instruction="Make the sky more dramatic with storm clouds",
            reference_image=src_path,
        )
        img.save("edited.jpg")
        print(f"Saved edited.jpg  ({img.image.size[0]}x{img.image.size[1]})")
        print(f"  request_id={img.request_id}  credits_used={img.credits_used}")

    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
