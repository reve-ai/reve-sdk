"""Response classes for the Reve Python SDK."""

from __future__ import annotations

import io
from typing import Any

try:
    from PIL import Image as PILImage

    _HAS_PIL = True
except ImportError:  # pragma: no cover
    _HAS_PIL = False

try:
    from pydantic import BaseModel as _PydanticBase
    from pydantic import ConfigDict

    _HAS_PYDANTIC = True
except ImportError:  # pragma: no cover
    _HAS_PYDANTIC = False


def _build_image_response_class() -> type:
    """Construct the ``ImageResponse`` class at import time.

    When *pydantic* is available the returned class is a pydantic
    ``BaseModel`` subclass with full validation.  Otherwise it is a
    plain Python class with an identical public API.
    """

    if _HAS_PYDANTIC:

        class _ImageResponse(_PydanticBase):
            """Response from an image generation API call (pydantic variant)."""

            model_config = ConfigDict(arbitrary_types_allowed=True)

            image: Any = None
            image_bytes: bytes = b""
            request_id: str | None = None
            credits_used: int | None = None
            credits_remaining: int | None = None
            version: str | None = None
            content_violation: bool = False

    else:

        class _ImageResponse:  # type: ignore[no-redef]
            """Response from an image generation API call (plain variant)."""

            __slots__ = (
                "image",
                "image_bytes",
                "request_id",
                "credits_used",
                "credits_remaining",
                "version",
                "content_violation",
            )

            def __init__(
                self,
                *,
                image: Any = None,
                image_bytes: bytes = b"",
                request_id: str | None = None,
                credits_used: int | None = None,
                credits_remaining: int | None = None,
                version: str | None = None,
                content_violation: bool = False,
            ) -> None:
                self.image = image
                self.image_bytes = image_bytes
                self.request_id = request_id
                self.credits_used = credits_used
                self.credits_remaining = credits_remaining
                self.version = version
                self.content_violation = content_violation

    # -- Attach shared methods to whichever variant was chosen. --

    @classmethod  # type: ignore[misc]
    def _from_raw(
        cls,
        image_bytes: bytes,
        metadata: dict | None = None,
    ) -> _ImageResponse:
        """Create an ImageResponse from raw image bytes and header metadata."""
        meta = metadata or {}
        img = None
        if _HAS_PIL:
            img = PILImage.open(io.BytesIO(image_bytes))
        credits_used = meta.get("credits_used")
        credits_remaining = meta.get("credits_remaining")
        return cls(
            image=img,
            image_bytes=image_bytes,
            request_id=meta.get("request_id"),
            credits_used=int(credits_used) if credits_used is not None else None,
            credits_remaining=int(credits_remaining) if credits_remaining is not None else None,
            version=meta.get("version"),
            content_violation=meta.get("content_violation", False),
        )

    def _save(self, path: str, **kwargs: Any) -> None:
        """Save the image to a file."""
        if _HAS_PIL and self.image is not None:
            self.image.save(path, **kwargs)
        else:
            with open(path, "wb") as fh:
                fh.write(self.image_bytes)

    def _repr(self) -> str:
        if _HAS_PIL and self.image is not None:
            w, h = self.image.size
            return "<ImageResponse request_id={!r} size={}x{}>".format(self.request_id, w, h)
        nbytes = len(self.image_bytes)
        return "<ImageResponse request_id={!r} bytes={}>".format(self.request_id, nbytes)

    _ImageResponse.from_raw = _from_raw  # type: ignore[attr-defined]
    _ImageResponse.save = _save  # type: ignore[attr-defined]
    _ImageResponse.__repr__ = _repr  # type: ignore[attr-defined]
    _ImageResponse.__name__ = "ImageResponse"
    _ImageResponse.__qualname__ = "ImageResponse"

    return _ImageResponse


ImageResponse = _build_image_response_class()  # type: ignore[misc]
