"""Example: Generate images from text prompts using the Reve API.

Demonstrates basic image creation, creation with a specific aspect ratio,
and creation with postprocessing (upscale + remove_background).

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v1.image import create
from reve.v1.postprocessing import remove_background, upscale


def main():
    # Ensure the API token is configured
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    try:
        # --- Basic create ------------------------------------------------
        print("Generating a sunset image …")
        img = create(prompt="A beautiful sunset over the ocean")
        img.save("sunset.jpg")
        print(f"Saved sunset.jpg  ({img.image.size[0]}x{img.image.size[1]})")
        print(f"  request_id={img.request_id}  credits_used={img.credits_used}")

        # --- Create with aspect ratio -----------------------------------
        print("\nGenerating a wide landscape …")
        img = create(
            prompt="Rolling green hills under a dramatic cloudy sky",
            aspect_ratio="16:9",
        )
        img.save("landscape.jpg")
        print(f"Saved landscape.jpg  ({img.image.size[0]}x{img.image.size[1]})")

        # --- Create with postprocessing ----------------------------------
        print("\nGenerating an upscaled dragon with transparent background …")
        img = create(
            prompt="A red dragon flying over mountains",
            postprocessing=[upscale(factor=2), remove_background()],
        )
        img.save("dragon.png")
        print(f"Saved dragon.png  ({img.image.size[0]}x{img.image.size[1]})")

    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
