"""Example: Generate a layout-aware image with the v2 create API.

The v2 ``create`` function takes a top-level instruction and an optional
structured ``Description``: a layout of labelled regions, each with its own
prompt and a normalized bounding box (``x0, y0, x1, y1`` in ``[0, 1]``,
top-left origin). The response can echo back the layout the model actually
generated.

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v2.image import create
from reve.v2.types import Bbox, Description, Region


def main():
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    # Describe the target layout: a plate, a glass, a knife, a fork, on a table
    description = Description(
        prompt="An elegant place setting on a rustic wooden table.",
        regions=[
            Region(
                label="table",
                prompt="A rustic wood table surface seen from above, with large coarse planks running horizontally",
                bbox=Bbox(x0=0, y0=0, x1=1, y1=0.95),
            ),
            Region(
                label="plate",
                prompt="A elegant porcelain plate with two green beans placed in a cross on it seen from above",
                bbox=Bbox(x0=0.25, y0=0.4, x1=0.75, y1=0.9),
            ),
            Region(
                label="glass",
                prompt="A drinking glass with amber beer and white foam seen from above",
                bbox=Bbox(x0=0.4, y0=0.1, x1=0.6, y1=0.3),
            ),
            Region(
                label="fork",
                prompt="An antique silver fork",
                bbox=Bbox(x0=0.1, y0=0.5, x1=0.2, y1=0.9),
            ),
            Region(
                label="knife",
                prompt="An antique steak knife",
                bbox=Bbox(x0=0.8, y0=0.5, x1=0.9, y1=0.9),
            ),
            Region(
                label="floor",
                prompt="A floor covered in sawdust, dark and out of focus",
                bbox=Bbox(x0=0.0, y0=0.95, x1=1.0, y1=1.0),
            ),
        ],
    )

    try:
        print("Generating a layout-aware image …")
        result = create(
            instruction="Create an advertising photo for a restaurant, featuring two green beens crossed on an elegant white porcelain plate, flanked by antique fork and knife, crowned by a glass of frothing beer, all placed on a rustic wooden plank table.",
            description=description,
            aspect_ratio="1:1",
        )
        result.save("v2_create.jpg")
        print("Saved v2_create.jpg")
        print(f"  request_id={result.request_id}  credits_used={result.credits_used}")

        # The response may echo the layout the model generated.
        if result.description is not None:
            print("Generated layout:")
            for region in result.description.regions:
                b = region.bbox
                print(f"  - {region.label}: ({b.x0:.2f},{b.y0:.2f})-({b.x1:.2f},{b.y1:.2f})")

    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
