"""Example: Generate an image with the v2 create API.

The v2 ``create`` function takes a top-level instruction and optional reference
images, and returns an image. The response can also echo back the layout the
model actually generated.

Prerequisites:
    export REVE_API_TOKEN="papi.your-token-here"
"""

import os
import sys

from reve.exceptions import ReveAPIError
from reve.v2.image import create


def main():
    if not os.environ.get("REVE_API_TOKEN"):
        print("Set REVE_API_TOKEN environment variable first.")
        sys.exit(1)

    try:
        print("Generating an image …")
        result = create(
            instruction="Create an advertising photo for a restaurant, featuring two green beans crossed on an elegant white porcelain plate, flanked by an antique fork and knife, crowned by a glass of frothing beer, all placed on a rustic wooden plank table.",
            aspect_ratio="1:1",
        )
        result.save("v2_create.jpg")
        print("Saved v2_create.jpg")
        print(f"  request_id={result.request_id}  credits_used={result.credits_used}")

        # The response may echo the layout the model generated.
        if result.layout is not None:
            print("Generated layout:")
            for region in result.layout.regions:
                b = region.bbox
                print(f"  - {region.label}: ({b.x0:.2f},{b.y0:.2f})-({b.x1:.2f},{b.y1:.2f})")

    except ReveAPIError as exc:
        print(f"API error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
