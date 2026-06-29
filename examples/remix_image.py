"""Example: Remix images using reference images and a text prompt.

Reference images are passed as file paths (or bytes / PIL Images).
Use ``<ref>0</ref>``, ``<ref>1</ref>``, etc. in the prompt to refer
to each reference image by its index.

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"

Usage:
    python remix_image.py path/to/reference.jpg
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v1.image import remix


def main():
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    # Accept a reference image path from the command line (or use a default)
    ref_path = sys.argv[1] if len(sys.argv) > 1 else "reference.jpg"
    if not os.path.isfile(ref_path):
        print(f"Reference image not found: {ref_path}")
        sys.exit(1)

    try:
        print(f"Remixing with reference image: {ref_path}")
        img = remix(
            prompt="The subject from <ref>0</ref> standing in a magical forest",
            reference_images=[ref_path],
            aspect_ratio="1:1",
        )
        img.save("remix_result.jpg")
        print(f"Saved remix_result.jpg  ({img.image.size[0]}x{img.image.size[1]})")
        print(f"  request_id={img.request_id}  credits_used={img.credits_used}")

    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
