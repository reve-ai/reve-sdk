"""Reve v2 layout-aware image API functions.

High-level wrappers for the five ``/v2/image`` endpoints: :func:`create`,
:func:`extract_layout`, :func:`create_layout`, :func:`render_layout`, and
:func:`reconcile_layout`.
Requests and responses carry structured :class:`~reve.v2.types.Layout` and
:class:`~reve.v2.types.Reference` values where appropriate.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, Literal

from .._client import ReveClient
from ..exceptions import ReveAPIError, ReveContentViolationError
from ..v1.image import _resolve_client
from .types import (
    ImageInput,
    Layout,
    LayoutCommand,
    Reference,
    V2ImageResponse,
    V2LayoutResponse,
)

if TYPE_CHECKING:
    from .types import RawImage

#: A postprocessing operation dict (see :mod:`reve.v1.postprocessing`).
Postprocessing = dict[str, Any]

#: Aspect ratios accepted by the v2 endpoints (width:height), plus ``"auto"``.
AspectRatio = Literal[
    "4:1",
    "3:1",
    "21:9",
    "2:1",
    "17:9",
    "16:9",
    "3:2",
    "4:3",
    "5:4",
    "1:1",
    "4:5",
    "3:4",
    "2:3",
    "9:16",
    "1:2",
    "1:3",
    "1:4",
    "auto",
]


def _coerce_image_input(image: ImageInput | RawImage) -> ImageInput:
    """Wrap a raw image (path/bytes/PIL) in an :class:`ImageInput`."""
    if isinstance(image, ImageInput):
        return image
    return ImageInput(data=image)


def _add_optional(body: dict[str, Any], key: str, value: Any) -> None:
    """Set ``body[key] = value`` unless *value* is ``None``."""
    if value is not None:
        body[key] = value


def _add_references(body: dict[str, Any], references: Sequence[Reference] | None) -> None:
    """Serialize and attach *references* to *body* when provided."""
    if references is not None:
        body["references"] = [r.to_dict() for r in references]


def _add_image_references(
    body: dict[str, Any], references: Sequence[ImageInput | RawImage] | None
) -> None:
    """Serialize and attach image-only *references* to *body* when provided."""
    if references is not None:
        body["references"] = [_coerce_image_input(r).to_dict() for r in references]


def _add_commands(body: dict[str, Any], commands: Sequence[LayoutCommand] | None) -> None:
    """Serialize and attach create_layout *commands* to *body* when provided."""
    if commands is not None:
        body["commands"] = [c.to_dict() for c in commands]


def _layout_options(
    body: dict[str, Any],
    *,
    aspect_ratio: AspectRatio | None,
    version: str | None,
) -> None:
    """Apply the ``aspect_ratio`` and ``version`` options to *body* in place."""
    _add_optional(body, "aspect_ratio", aspect_ratio)
    _add_optional(body, "version", version)


def _image_options(
    body: dict[str, Any],
    *,
    aspect_ratio: AspectRatio | None,
    postprocessing: Sequence[Postprocessing] | None,
    version: str | None,
) -> None:
    """Apply options shared by the image-producing endpoints to *body*."""
    _add_optional(body, "aspect_ratio", aspect_ratio)
    if postprocessing is not None:
        body["postprocessing"] = list(postprocessing)
    _add_optional(body, "version", version)


def _post_json(client: ReveClient | None, path: str, body: dict[str, Any]) -> dict[str, Any]:
    """POST a v2 request and return the parsed JSON body.

    Raises:
        ReveAPIError: For API errors, or if the response is not JSON.
    """
    resp = _resolve_client(client).post(path, body, accept="application/json")
    if not isinstance(resp, dict):
        raise ReveAPIError(
            message=f"Unexpected non-JSON response from v2 image endpoint: {str(resp)[:50]!r}",
            payload=resp,
        )
    return resp


def _image_result(resp: dict[str, Any]) -> V2ImageResponse:
    """Parse an image-producing response, raising on content violation."""
    result = V2ImageResponse.from_json(resp)
    if result.content_violation:
        raise ReveContentViolationError(
            message="Content violation detected in response",
            request_id=result.request_id,
        )
    return result


def _layout_result(resp: dict[str, Any]) -> V2LayoutResponse:
    """Parse a layout-producing response, raising on content violation."""
    result = V2LayoutResponse.from_json(resp)
    if result.content_violation:
        raise ReveContentViolationError(
            message="Content violation detected in response",
            request_id=result.request_id,
        )
    return result


def create(
    prompt: str,
    *,
    references: Sequence[ImageInput | RawImage] | None = None,
    aspect_ratio: AspectRatio | None = None,
    postprocessing: Sequence[Postprocessing] | None = None,
    version: str | None = None,
    client: ReveClient | None = None,
) -> V2ImageResponse:
    """Generate an image from a text prompt (``/v2/image/create``).

    Args:
        prompt: Top-level free-text prompt (max 4000 characters).
        references: Optional reference images (at most 8), each an
            :class:`~reve.v2.types.ImageInput`, or a file path, raw bytes, or
            PIL Image.
        aspect_ratio: One of the ratios in :data:`AspectRatio`; defaults to
            ``"auto"``.
        postprocessing: Postprocessing operations (see
            :mod:`reve.v1.postprocessing`).
        version: Model version. Defaults to ``"latest"``, which aliases the
            flow's current pinned version; the version actually used is reported
            on the response. The pinned version string is also accepted.
        client: Pre-configured :class:`~reve._client.ReveClient`. If ``None``,
            a default client is created from environment variables.

    Returns:
        A :class:`~reve.v2.types.V2ImageResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
    """
    body: dict[str, Any] = {"prompt": prompt}
    _add_image_references(body, references)
    _image_options(body, aspect_ratio=aspect_ratio, postprocessing=postprocessing, version=version)
    return _image_result(_post_json(client, "/v2/image/create", body))


def extract_layout(
    image: ImageInput | RawImage,
    *,
    prompt: str | None = None,
    version: str | None = None,
    client: ReveClient | None = None,
) -> V2LayoutResponse:
    """Extract or edit a layout from one image (``/v2/image/extract_layout``).

    Without a prompt, the endpoint extracts the image's current layout. With a
    prompt, it creates an edited layout guided by the image. Both modes preserve
    the source image's coordinate frame.

    Args:
        image: The image to derive a layout from (an
            :class:`~reve.v2.types.ImageInput`, or a file path, raw bytes, or
            PIL Image).
        prompt: Optional editing instruction (max 4000 characters).
        version: See :func:`create`.
        client: See :func:`create`.

    Returns:
        A :class:`~reve.v2.types.V2LayoutResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
    """
    body: dict[str, Any] = {"image": _coerce_image_input(image).to_dict()}
    _add_optional(body, "prompt", prompt)
    _add_optional(body, "version", version)
    return _layout_result(_post_json(client, "/v2/image/extract_layout", body))


def create_layout(
    prompt: str | None = None,
    *,
    references: Sequence[Reference] | None = None,
    commands: Sequence[LayoutCommand] | None = None,
    aspect_ratio: AspectRatio | None = None,
    version: str | None = None,
    client: ReveClient | None = None,
) -> V2LayoutResponse:
    """Generate or edit a layout (``/v2/image/create_layout``).

    At least one of ``prompt`` or ``references`` is required. Prompt-only input
    creates a layout from scratch. Any references switch to layout editing,
    guided by their ordered image, layout, and descriptive-prompt fields.
    Commands require at least one reference.

    This endpoint returns JSON only: a layout, with no image. Use
    :func:`render_layout` to turn the layout into an image.

    Args:
        prompt: Optional free-text prompt describing the desired image
            (max 4000 characters).
        references: Optional references (at most 8) guiding the layout, each an
            image and/or a layout.
        commands: Optional ordered layout-editing commands. Requires at least
            one reference.
        aspect_ratio: Target aspect ratio for the produced layout; see
            :data:`AspectRatio`. Defaults to ``"auto"``.
        version: See :func:`create`.
        client: See :func:`create`.

    Returns:
        A :class:`~reve.v2.types.V2LayoutResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
    """
    body: dict[str, Any] = {}
    _add_optional(body, "prompt", prompt)
    _add_references(body, references)
    _add_commands(body, commands)
    _layout_options(body, aspect_ratio=aspect_ratio, version=version)
    return _layout_result(_post_json(client, "/v2/image/create_layout", body))


def render_layout(
    layout: Layout,
    *,
    references: Sequence[Reference] | None = None,
    postprocessing: Sequence[Postprocessing] | None = None,
    version: str | None = None,
    client: ReveClient | None = None,
) -> V2ImageResponse:
    """Render an image from a layout (``/v2/image/render_layout``).

    The aspect ratio is derived from the target layout. References may contain
    images, layouts, and descriptive prompts. Layout-only references provide
    structural context but cannot be targeted as pixel sources.

    Args:
        layout: The target layout to render.
        references: Optional ordered references (at most 8).
        postprocessing: See :func:`create`.
        version: See :func:`create`.
        client: See :func:`create`.

    Returns:
        A :class:`~reve.v2.types.V2ImageResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
    """
    body: dict[str, Any] = {"layout": layout.to_dict()}
    _add_references(body, references)
    if postprocessing is not None:
        body["postprocessing"] = list(postprocessing)
    _add_optional(body, "version", version)
    return _image_result(_post_json(client, "/v2/image/render_layout", body))


def reconcile_layout(
    original_layout: Layout,
    edited_layout: Layout,
    *,
    version: str | None = None,
    client: ReveClient | None = None,
) -> V2LayoutResponse:
    """Reconcile a directly edited layout against its original (``/v2/image/reconcile_layouts``).

    Structural changes are reconciled against the original layout, while
    prompt and color edits are harmonized. The endpoint returns the reconciled
    layout without rendering an image.

    Args:
        original_layout: The layout from which the edits started.
        edited_layout: The layout after direct client or user edits.
        version: See :func:`create`.
        client: See :func:`create`.

    Returns:
        A :class:`~reve.v2.types.V2LayoutResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
    """
    body: dict[str, Any] = {
        "original_layout": original_layout.to_dict(),
        "edited_layout": edited_layout.to_dict(),
    }
    _add_optional(body, "version", version)
    return _layout_result(_post_json(client, "/v2/image/reconcile_layouts", body))
