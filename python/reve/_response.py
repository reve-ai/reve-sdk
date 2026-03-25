"""Response classes for the Reve Python SDK."""

from __future__ import annotations

import io

from PIL import Image as PILImage
from pydantic import BaseModel, ConfigDict


class ImageResponse(BaseModel):
    """Response from an image generation API call.

    Contains the generated image as a PIL Image object along with
    metadata about the request.

    Attributes:
        image: PIL.Image.Image object containing the generated image.
        request_id: Unique identifier for the API request.
        credits_used: Number of API credits consumed by this request.
        credits_remaining: Number of API credits remaining in the budget.
        version: Model version used for generation.
        content_violation: Whether a content policy violation was detected.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    image: PILImage.Image
    request_id: str | None = None
    credits_used: int | None = None
    credits_remaining: int | None = None
    version: str | None = None
    content_violation: bool = False

    @classmethod
    def from_raw(
        cls,
        image_bytes: bytes,
        metadata: dict | None = None,
    ) -> ImageResponse:
        """Create an ImageResponse from raw image bytes and header metadata.

        Args:
            image_bytes: Raw image file bytes (JPEG, PNG, etc.).
            metadata: Dict of header values. Supported keys:
                ``request_id``, ``credits_used``, ``credits_remaining``,
                ``version``, ``content_violation``.

        Returns:
            ImageResponse with parsed image and metadata.
        """
        meta = metadata or {}
        img = PILImage.open(io.BytesIO(image_bytes))
        credits_used = meta.get("credits_used")
        credits_remaining = meta.get("credits_remaining")
        return cls(
            image=img,
            request_id=meta.get("request_id"),
            credits_used=int(credits_used) if credits_used is not None else None,
            credits_remaining=int(credits_remaining) if credits_remaining is not None else None,
            version=meta.get("version"),
            content_violation=meta.get("content_violation", False),
        )

    def save(self, *args, **kwargs):
        """Save the image to a file. Delegates to PIL.Image.save().

        Args:
            *args: Positional arguments passed to PIL.Image.save().
            **kwargs: Keyword arguments passed to PIL.Image.save().
        """
        return self.image.save(*args, **kwargs)

    def __repr__(self) -> str:
        w, h = self.image.size
        return "<ImageResponse request_id={!r} size={}x{}>".format(self.request_id, w, h)
