"""Example: Edit an image with the layout-aware v2 edit API.

The v2 ``edit`` function takes a base image plus a top-level instruction.
Reference images can be supplied via ``Reference`` objects (each an image
with an optional prompt), and the edit can be guided by diffing an
``old_description`` against a ``new_description``.

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"

Usage:
    python v2_edit_image.py path/to/original.jpg [path/to/reference.jpg]
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v2.image import edit
from reve.v2.types import ImageInput, Reference


def main():
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    args = sys.argv[1:]
    src_path = args[0] if args else "original.jpg"
    if not os.path.isfile(src_path):
        print(f"Source image not found: {src_path}")
        sys.exit(1)

    # Optionally guide the edit with a reference image (e.g. a style or subject).
    references = None
    ref_path = args[1] if len(args) > 1 else None
    if ref_path and os.path.isfile(ref_path):
        references = [
            Reference(
                image=ImageInput(data=ref_path),
                prompt="Match the lighting and mood of this image",
            )
        ]

    try:
        print(f"Editing image: {src_path}")
        result = edit(
            instruction="Make the sky more dramatic with storm clouds",
            image=src_path,
            references=references,
        )
        result.save("v2_edited.jpg")
        print("Saved v2_edited.jpg")
        print(f"  request_id={result.request_id}  credits_used={result.credits_used}")

        if result.description is not None:
            print("Generated layout:")
            for region in result.description.regions:
                print(f"  - {region.label}: {region.prompt}")

    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
