"""Typed structures for the Reve v2 layout-aware image API.

The v2 ``/v2/image/create`` and ``/v2/image/edit`` endpoints are layout
aware: instead of embedding image references in free text, the request
carries a structured ``description`` (a layout of labelled, bounded
regions) and a list of reference images. These dataclasses describe the
inputs and outputs of those endpoints with explicit type annotations.
"""

from __future__ import annotations

import base64
import io
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from ..exceptions import ReveAPIError, ReveValidationError
from ..v1.image import encode_image

if TYPE_CHECKING:
    from PIL.Image import Image as _PILImage

    #: An image supplied verbatim: a file path (str), raw bytes, or PIL Image.
    RawImage = str | bytes | _PILImage

try:
    from PIL import Image as _PILImageModule

    _HAS_PIL = True
except ImportError:  # pragma: no cover
    _HAS_PIL = False


@dataclass
class ImageInput:
    """A ``v2_image_input``: provide exactly one of ``data`` or ``ref``.

    Args:
        data: Verbatim image data as a file path, raw bytes, or PIL Image.
            Base-64 encoded when serialized to JSON.
        ref: An identifier string pointing at an image that already exists
            in the project your API key belongs to. Either ``id:<uuid>`` —
            the ID of an image or generation in the project (for example,
            one created in the Reve app; a generation ID resolves to that
            generation's output image) — or ``reference:@<name>`` — the
            name of a reference entity defined in the project in the Reve
            app.
    """

    data: RawImage | None = None
    ref: str | None = None

    def to_dict(self) -> dict[str, Any]:
        if (self.data is None) == (self.ref is None):
            raise ReveValidationError(message="ImageInput requires exactly one of 'data' or 'ref'")
        if self.data is not None:
            return {"data": encode_image(self.data)}
        return {"ref": self.ref}


@dataclass
class Bbox:
    """A normalized bounding box with top-left origin; values in ``[0, 1]``."""

    x0: float
    y0: float
    x1: float
    y1: float

    def to_dict(self) -> dict[str, float]:
        return {"x0": self.x0, "y0": self.y0, "x1": self.x1, "y1": self.y1}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Bbox:
        return cls(x0=d["x0"], y0=d["y0"], x1=d["x1"], y1=d["y1"])


@dataclass
class Region:
    """A single region within a :class:`Description` layout.

    Args:
        label: Short entity name. Must be unique within the description.
        prompt: The regional prompt.
        bbox: Normalized bounding box of the region.
        preserve: Whether to preserve this region from the source. Defaults
            differ by endpoint (``False`` for create, ``True`` for edit).
        image_index: Index into the input images this region refers to.
        image_region_index: Index of the corresponding region within the
            referenced image's layout.
    """

    label: str
    prompt: str
    bbox: Bbox
    preserve: bool | None = None
    image_index: int | None = None
    image_region_index: int | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "label": self.label,
            "prompt": self.prompt,
            "bbox": self.bbox.to_dict(),
        }
        if self.preserve is not None:
            out["preserve"] = self.preserve
        if self.image_index is not None:
            out["image_index"] = self.image_index
        if self.image_region_index is not None:
            out["image_region_index"] = self.image_region_index
        return out

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Region:
        return cls(
            label=d.get("label", ""),
            prompt=d.get("prompt", ""),
            bbox=Bbox.from_dict(d["bbox"]),
            preserve=d.get("preserve"),
            image_index=d.get("image_index"),
            image_region_index=d.get("image_region_index"),
        )


@dataclass
class Description:
    """A layout: an optional overall ``prompt`` plus a list of ``regions``."""

    regions: list[Region] = field(default_factory=list)
    prompt: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"regions": [r.to_dict() for r in self.regions]}
        if self.prompt is not None:
            out["prompt"] = self.prompt
        return out

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Description:
        regions = [Region.from_dict(r) for r in d.get("regions", [])]
        return cls(regions=regions, prompt=d.get("prompt"))


@dataclass
class Reference:
    """A reference image plus an optional natural-language prompt."""

    image: ImageInput
    prompt: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"image": self.image.to_dict()}
        if self.prompt is not None:
            out["prompt"] = self.prompt
        return out


def _coerce_bool(value: Any) -> bool:
    """Coerce a JSON boolean-or-string-bool value to ``bool``."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in {"true", "1", "yes"}
    return bool(value)


def _coerce_int(value: Any) -> int | None:
    """Convert *value* to ``int`` if not ``None``."""
    return int(value) if value is not None else None


def _decode_image_bytes(body: dict[str, Any]) -> bytes:
    """Decode the base64 ``image`` field of a response body to raw bytes."""
    encoded = body.get("image") or ""
    if not encoded:
        return b""
    try:
        return base64.b64decode(encoded)
    except (ValueError, TypeError) as exc:
        raise ReveAPIError(
            message=f"Invalid base64 image data in v2 image response: {exc}"
        ) from exc


def _parse_description(body: dict[str, Any]) -> Description | None:
    """Parse the ``description`` field of a response body, validating its shape."""
    raw_description = body.get("description")
    if raw_description is None:
        return None
    if not isinstance(raw_description, dict):
        raise ReveAPIError(
            message="Unexpected 'description' type in v2 image response: "
            f"{type(raw_description).__name__}: {str(raw_description)[:50]!r}",
            payload=raw_description,
        )
    return Description.from_dict(raw_description) if raw_description else None


@dataclass
class V2ImageResponse:
    """Response from a v2 image create/edit call.

    Attributes:
        image: The generated image as a ``PIL.Image.Image`` when Pillow is
            installed, otherwise ``None``.
        image_bytes: Raw bytes of the generated image.
        description: The layout the model actually generated, or ``None`` if
            the endpoint returned no layout.
        request_id: Unique request identifier.
        credits_used: Credits consumed by this request.
        credits_remaining: Credits remaining in the budget.
        version: Model version used to generate the image.
        content_violation: Whether the system flagged a content violation.
    """

    image: _PILImage | None = None
    image_bytes: bytes = b""
    description: Description | None = None
    request_id: str | None = None
    credits_used: int | None = None
    credits_remaining: int | None = None
    version: str | None = None
    content_violation: bool = False

    @classmethod
    def from_json(cls, body: dict[str, Any]) -> V2ImageResponse:
        """Build a response from a parsed ``v1_image_response`` JSON body."""
        image_bytes = _decode_image_bytes(body)
        image = None
        if _HAS_PIL and image_bytes:
            image = _PILImageModule.open(io.BytesIO(image_bytes))
        return cls(
            image=image,
            image_bytes=image_bytes,
            description=_parse_description(body),
            request_id=body.get("request_id"),
            credits_used=_coerce_int(body.get("credits_used")),
            credits_remaining=_coerce_int(body.get("credits_remaining")),
            version=body.get("version"),
            content_violation=_coerce_bool(body.get("content_violation")),
        )

    def save(self, path: str, **kwargs: Any) -> None:
        """Save the generated image to ``path``."""
        if _HAS_PIL and self.image is not None:
            self.image.save(path, **kwargs)
        else:
            with open(path, "wb") as fh:
                fh.write(self.image_bytes)

    def __repr__(self) -> str:
        if _HAS_PIL and self.image is not None:
            w, h = self.image.size
            return f"<V2ImageResponse request_id={self.request_id!r} size={w}x{h}>"
        return f"<V2ImageResponse request_id={self.request_id!r} bytes={len(self.image_bytes)}>"
