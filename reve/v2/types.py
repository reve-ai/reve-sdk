"""Typed structures for the Reve v2 layout-aware image API.

The v2 ``/v2/image`` endpoints are layout aware: instead of embedding image
references in free text, requests and responses carry a structured
:class:`Layout` (a list of labelled, bounded :class:`Region` s) alongside any
reference images. These dataclasses describe the inputs and outputs of those
endpoints with explicit type annotations.
"""

from __future__ import annotations

import base64
import io
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

from ..exceptions import ReveAPIError, ReveValidationError
from ..v1.image import encode_image

if TYPE_CHECKING:
    from PIL.Image import Image as _PILImage

    #: An image supplied verbatim: a file path (str), raw bytes, or PIL Image.
    RawImage = str | bytes | _PILImage

#: A region's level-of-detail / special-handling hint.
#:
#: - ``"coarse_detail"``: a high-level object, such as a person or a car.
#: - ``"medium_detail"``: a medium-level object, such as an arm, a belt, or a
#:   wheel, whose parent is a ``"coarse_detail"`` region.
#: - ``"fine_detail"``: a fine detail, such as a ring, a buckle, or a lug nut,
#:   whose parent is a ``"medium_detail"`` region.
#: - ``"text"``: a region of text embedded into the image.
#: - ``"hand"``: a special region kind for human hands.
#: - ``"face"``: a special region kind for human faces.
RegionType = Literal["coarse_detail", "medium_detail", "fine_detail", "text", "hand", "face"]

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
class Point:
    """A normalized point with top-left origin; values in ``[0, 1]``."""

    x: float
    y: float

    def to_dict(self) -> dict[str, float]:
        return {"x": self.x, "y": self.y}

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Point:
        return cls(x=d["x"], y=d["y"])


#: A command position: a bounding box (:class:`Bbox`) or a single :class:`Point`.
#: Used for a :class:`LayoutCommand`'s ``at`` and ``to`` fields. Coordinates are
#: normalized to ``[0, 1]`` with a top-left origin.
BboxOrPoint = Bbox | Point


@dataclass
class Region:
    """A single region within a :class:`Layout`.

    Args:
        label: Short entity name. Must be unique within the layout.
        prompt: The regional prompt.
        bbox: Normalized bounding box of the region.
        image_index: Index into the endpoint's ordered references. References
            are frames ``0..N-1``.
        image_region_index: Index of the corresponding region within the
            referenced image's layout (the first region is index ``0``).
        parent: The ``label`` of this region's parent region within the same
            layout, establishing a containment hierarchy (e.g. a ``"face"``
            whose parent is a ``"person"``). Omit for top-level regions.
        region_type: A level-of-detail / special-handling hint; see
            :data:`RegionType`. Omit to let the model choose.
    """

    label: str
    prompt: str
    bbox: Bbox
    image_index: int | None = None
    image_region_index: int | None = None
    parent: str | None = None
    region_type: RegionType | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "label": self.label,
            "prompt": self.prompt,
            "bbox": self.bbox.to_dict(),
        }
        if self.image_index is not None:
            out["image_index"] = self.image_index
        if self.image_region_index is not None:
            out["image_region_index"] = self.image_region_index
        if self.parent is not None:
            out["parent"] = self.parent
        if self.region_type is not None:
            out["region_type"] = self.region_type
        return out

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Region:
        return cls(
            label=d.get("label", ""),
            prompt=d.get("prompt", ""),
            bbox=Bbox.from_dict(d["bbox"]),
            image_index=d.get("image_index"),
            image_region_index=d.get("image_region_index"),
            parent=d.get("parent"),
            region_type=d.get("region_type"),
        )


@dataclass
class Layout:
    """A layout: an overall ``prompt`` plus a list of ``regions``.

    Args:
        regions: The regions composing the layout.
        prompt: Overall caption/prompt for the layout.
        normalized_edit_instruction: The model's canonicalized form of an edit
            instruction. Accepted by :func:`~reve.v2.image.render_layout` and
            emitted when :func:`~reve.v2.image.create_layout` edits references.
        width: Pixel width of the layout's coordinate frame. Emitted by the
            layout endpoints (always a multiple of 32). On input, ``width``
            and ``height`` must be provided together, each a multiple of 32,
            with ``width * height`` between ``3072*2560`` and ``4096*4096``.
        height: Pixel height of the layout's coordinate frame. See ``width``.
    """

    regions: list[Region] = field(default_factory=list)
    prompt: str | None = None
    normalized_edit_instruction: str | None = None
    width: int | None = None
    height: int | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"regions": [r.to_dict() for r in self.regions]}
        if self.prompt is not None:
            out["prompt"] = self.prompt
        if self.normalized_edit_instruction is not None:
            out["normalized_edit_instruction"] = self.normalized_edit_instruction
        if self.width is not None:
            out["width"] = self.width
        if self.height is not None:
            out["height"] = self.height
        return out

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Layout:
        regions = [Region.from_dict(r) for r in d.get("regions", [])]
        return cls(
            regions=regions,
            prompt=d.get("prompt"),
            normalized_edit_instruction=d.get("normalized_edit_instruction"),
            width=d.get("width"),
            height=d.get("height"),
        )


@dataclass
class Reference:
    """A reference image and/or layout, plus an optional prompt.

    Args:
        image: The reference image input. Optional: a reference may be
            layout-only when guiding :func:`~reve.v2.image.create_layout` or
            :func:`~reve.v2.image.render_layout`.
        prompt: Optional natural-language prompt for the reference.
        layout: Optional layout describing the reference's own regions.
            Consumed by :func:`~reve.v2.image.create_layout` and
            :func:`~reve.v2.image.render_layout`.
    """

    image: ImageInput | None = None
    prompt: str | None = None
    layout: Layout | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        if self.image is not None:
            out["image"] = self.image.to_dict()
        if self.prompt is not None:
            out["prompt"] = self.prompt
        if self.layout is not None:
            out["layout"] = self.layout.to_dict()
        return out


#: The operation a :class:`LayoutCommand` performs.
#:
#: - ``"add"``: add a new subject, optionally ``at`` a position.
#: - ``"shift"``: move a subject (optionally ``at`` its current position) ``to``
#:   a destination position.
#: - ``"remove"``: remove a subject, optionally ``at`` a position and/or from an
#:   ``image_index`` frame.
#: - ``"place"``: place a subject ``at`` a required position.
#: - ``"keep"``: keep a subject, optionally ``at`` a position and/or from a
#:   frame.
#: - ``"change"``: change a subject's description to ``new_description``.
LayoutCommandOp = Literal["add", "shift", "remove", "place", "keep", "change"]


@dataclass
class LayoutCommand:
    """A single imperative layout-editing command for ``create_layout``.

    ``op`` selects the operation; the remaining fields are interpreted per
    ``op`` (see :data:`LayoutCommandOp`). The subject is named by either
    ``label`` (a short entity name) or ``description`` (a longer free-text
    description). ``image_index`` selects an input reference image (0-based).
    ``at`` and ``to`` are positions, each a :class:`Bbox` or a :class:`Point`.
    ``new_description`` supplies the replacement text for ``"change"``.

    Args:
        op: Which layout operation to perform.
        label: Short entity name identifying the subject.
        description: Free-text description identifying the subject.
        image_index: Index (0-based) of the input reference image the subject
            comes from.
        at: The subject's position (a :class:`Bbox` or a :class:`Point`).
        to: Destination position for ``"shift"`` (a :class:`Bbox` or a
            :class:`Point`).
        new_description: Replacement description for ``"change"``.
    """

    op: LayoutCommandOp
    label: str | None = None
    description: str | None = None
    image_index: int | None = None
    at: BboxOrPoint | None = None
    to: BboxOrPoint | None = None
    new_description: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"op": self.op}
        if self.label is not None:
            out["label"] = self.label
        if self.description is not None:
            out["description"] = self.description
        if self.image_index is not None:
            out["image_index"] = self.image_index
        if self.at is not None:
            out["at"] = self.at.to_dict()
        if self.to is not None:
            out["to"] = self.to.to_dict()
        if self.new_description is not None:
            out["new_description"] = self.new_description
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


def _parse_layout(body: dict[str, Any]) -> Layout | None:
    """Parse the ``layout`` field of a response body, validating its shape."""
    raw_layout = body.get("layout")
    if raw_layout is None:
        return None
    if not isinstance(raw_layout, dict):
        raise ReveAPIError(
            message="Unexpected 'layout' type in v2 image response: "
            f"{type(raw_layout).__name__}: {str(raw_layout)[:50]!r}",
            payload=raw_layout,
        )
    return Layout.from_dict(raw_layout) if raw_layout else None


@dataclass
class V2ImageResponse:
    """Response from an image-producing v2 call (create or render_layout).

    Attributes:
        image: The generated image as a ``PIL.Image.Image`` when Pillow is
            installed, otherwise ``None``.
        image_bytes: Raw bytes of the generated image.
        layout: The layout the model actually generated, or ``None`` if the
            endpoint returned no layout.
        request_id: Unique request identifier.
        credits_used: Credits consumed by this request.
        credits_remaining: Credits remaining in the budget.
        version: Model version used to generate the image.
        content_violation: Whether the system flagged a content violation.
    """

    image: _PILImage | None = None
    image_bytes: bytes = b""
    layout: Layout | None = None
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
            layout=_parse_layout(body),
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


@dataclass
class V2LayoutResponse:
    """Response from a layout-producing v2 call (extract_layout or create_layout).

    These endpoints derive or transform a layout and return no image.

    Attributes:
        layout: The layout the endpoint produced, or ``None`` if absent.
        request_id: Unique request identifier.
        credits_used: Credits consumed by this request.
        credits_remaining: Credits remaining in the budget.
        version: Model version used.
        content_violation: Whether the system flagged a content violation.
    """

    layout: Layout | None = None
    request_id: str | None = None
    credits_used: int | None = None
    credits_remaining: int | None = None
    version: str | None = None
    content_violation: bool = False

    @classmethod
    def from_json(cls, body: dict[str, Any]) -> V2LayoutResponse:
        """Build a response from a parsed ``v1_image_response`` JSON body."""
        return cls(
            layout=_parse_layout(body),
            request_id=body.get("request_id"),
            credits_used=_coerce_int(body.get("credits_used")),
            credits_remaining=_coerce_int(body.get("credits_remaining")),
            version=body.get("version"),
            content_violation=_coerce_bool(body.get("content_violation")),
        )

    def __repr__(self) -> str:
        n = len(self.layout.regions) if self.layout else 0
        return f"<V2LayoutResponse request_id={self.request_id!r} regions={n}>"
