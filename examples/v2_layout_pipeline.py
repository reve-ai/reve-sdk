"""Example: Drive the v2 layout pipeline end to end.

The layout-producing endpoints let you work with a ``Layout`` directly,
separating "what to draw and where" from "render the pixels":

  - ``create_layout``   — prompt + optional refs   -> Layout      (text/refs to layout)
  - ``render``          — Layout                   -> image       (layout2image)
  - ``image_to_layout`` — image                    -> Layout      (image2layout)

This script: generates a layout from a text prompt, renders an image from
that layout, then derives a layout back from the rendered image.

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v2.image import create_layout, image_to_layout, render


def _print_layout(label, layout):
    """Print a layout's regions with their bounding boxes."""
    if layout is None:
        print(f"{label}: (no layout returned)")
        return
    print(f"{label}: {len(layout.regions)} region(s)")
    for region in layout.regions:
        b = region.bbox
        kind = f" [{region.region_type}]" if region.region_type else ""
        print(f"  - {region.label}{kind}: ({b.x0:.2f},{b.y0:.2f})-({b.x1:.2f},{b.y1:.2f})")


def main():
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    try:
        # 1. text -> layout
        print("Creating a layout from a text prompt …")
        created = create_layout(
            prompt="A cozy reading nook: an armchair beside a tall bookshelf, a floor lamp behind the chair.",
            aspect_ratio="3:2",
        )
        _print_layout("Initial layout", created.layout)
        assert created.layout is not None

        # 2. layout -> image (render the generated layout)
        print("\nRendering the layout into an image …")
        rendered = render(layout=created.layout)
        rendered.save("v2_pipeline.jpg")
        print("Saved v2_pipeline.jpg")
        print(f"  request_id={rendered.request_id}  credits_used={rendered.credits_used}")

        # 3. image -> layout (derive a layout from the image we just rendered)
        print("\nDeriving a layout back from the rendered image …")
        analyzed = image_to_layout(image="v2_pipeline.jpg")
        _print_layout("Derived layout", analyzed.layout)

    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
