"""Reve v2 layout-aware image API functions.

Provides high-level :func:`create` and :func:`edit` functions for the
``/v2/image/create`` and ``/v2/image/edit`` endpoints. These endpoints are
layout aware: the request carries a structured :class:`~reve.v2.types.Description`
and a list of :class:`~reve.v2.types.Reference` images, and the response can
echo the layout the model actually generated.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, Literal

from .._client import ReveClient
from ..exceptions import ReveAPIError, ReveContentViolationError
from ..v1.image import _resolve_client
from .types import Description, ImageInput, Reference, V2ImageResponse

if TYPE_CHECKING:
    from .types import RawImage

#: A postprocessing operation dict (see :mod:`reve.v1.postprocessing`).
Postprocessing = dict[str, Any]

#: Aspect ratios accepted by the v2 create and edit endpoints.
AspectRatio = Literal["16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16", "auto"]


def _coerce_image_input(image: ImageInput | RawImage) -> ImageInput:
    """Wrap a raw image (path/bytes/PIL) in an :class:`ImageInput`."""
    if isinstance(image, ImageInput):
        return image
    return ImageInput(data=image)


def _add_optional(body: dict[str, Any], key: str, value: Any) -> None:
    """Set ``body[key] = value`` unless *value* is ``None``."""
    if value is not None:
        body[key] = value


def _common_options(
    body: dict[str, Any],
    *,
    aspect_ratio: AspectRatio | None,
    postprocessing: Sequence[Postprocessing] | None,
    version: str | None,
) -> None:
    """Apply options shared by create and edit to *body* in place."""
    _add_optional(body, "aspect_ratio", aspect_ratio)
    if postprocessing is not None:
        body["postprocessing"] = list(postprocessing)
    _add_optional(body, "version", version)


def _post(client: ReveClient | None, path: str, body: dict[str, Any]) -> V2ImageResponse:
    """POST a v2 image request and parse the JSON response.

    Raises:
        ReveContentViolationError: If the response flags a content violation.
        ReveAPIError: For API errors.
    """
    resp = _resolve_client(client).post(path, body, accept="application/json")
    if not isinstance(resp, dict):
        raise ReveAPIError(
            message=f"Unexpected non-JSON response from v2 image endpoint: {str(resp)[:50]!r}",
            payload=resp,
        )
    result = V2ImageResponse.from_json(resp)
    if result.content_violation:
        raise ReveContentViolationError(
            message="Content violation detected in response",
            request_id=result.request_id,
        )
    return result


def create(
    instruction: str,
    *,
    description: Description | None = None,
    references: Sequence[Reference] | None = None,
    aspect_ratio: AspectRatio | None = None,
    postprocessing: Sequence[Postprocessing] | None = None,
    version: str | None = None,
    client: ReveClient | None = None,
) -> V2ImageResponse:
    """Generate an image from a layout-aware instruction.

    Args:
        instruction: Top-level free-text instruction (max 4000 characters).
        description: Optional target layout of labelled, bounded regions.
        references: Optional reference images, each with an optional prompt.
        aspect_ratio: One of ``"16:9"``, ``"3:2"``, ``"4:3"``, ``"1:1"``,
            ``"3:4"``, ``"2:3"``, ``"9:16"``, or ``"auto"`` (the default).
        postprocessing: Postprocessing operations (see
            :mod:`reve.v1.postprocessing`).
        version: Model version; only ``"latest"`` is currently accepted.
        client: Pre-configured :class:`~reve._client.ReveClient`. If ``None``,
            a default client is created from environment variables.

    Returns:
        A :class:`~reve.v2.types.V2ImageResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
    """
    body: dict[str, Any] = {"instruction": instruction}
    _add_optional(body, "description", description.to_dict() if description else None)
    if references is not None:
        body["references"] = [r.to_dict() for r in references]
    _common_options(
        body,
        aspect_ratio=aspect_ratio,
        postprocessing=postprocessing,
        version=version,
    )
    return _post(client, "/v2/image/create", body)


def edit(
    instruction: str,
    image: ImageInput | RawImage,
    *,
    references: Sequence[Reference] | None = None,
    old_description: Description | None = None,
    new_description: Description | None = None,
    aspect_ratio: AspectRatio | None = None,
    postprocessing: Sequence[Postprocessing] | None = None,
    version: str | None = None,
    client: ReveClient | None = None,
) -> V2ImageResponse:
    """Edit an image using a layout-aware instruction.

    Args:
        instruction: Top-level free-text instruction (max 4000 characters).
        image: Base image to edit (an :class:`~reve.v2.types.ImageInput`, or a
            file path, raw bytes, or PIL Image).
        references: Optional additional reference images.
        old_description: Current layout of the base image.
        new_description: Pending layout, diffed against ``old_description`` to
            drive the edit.
        aspect_ratio: See :func:`create`.
        postprocessing: See :func:`create`.
        version: See :func:`create`.
        client: See :func:`create`.

    Returns:
        A :class:`~reve.v2.types.V2ImageResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
    """
    body: dict[str, Any] = {
        "instruction": instruction,
        "image": _coerce_image_input(image).to_dict(),
    }
    if references is not None:
        body["references"] = [r.to_dict() for r in references]
    _add_optional(body, "old_description", old_description.to_dict() if old_description else None)
    _add_optional(body, "new_description", new_description.to_dict() if new_description else None)
    _common_options(
        body,
        aspect_ratio=aspect_ratio,
        postprocessing=postprocessing,
        version=version,
    )
    return _post(client, "/v2/image/edit", body)
