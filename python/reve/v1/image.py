"""Reve v1 image API functions.

Provides high-level functions for image generation, remixing, editing,
balance checking, and effect listing.
"""

import base64
import io
from collections.abc import Sequence
from typing import Any

from .._client import ReveClient
from .._response import ImageResponse
from ..exceptions import ReveContentViolationError

try:
    from PIL import Image as _PILImage

    _HAS_PIL = True
except ImportError:  # pragma: no cover
    _HAS_PIL = False

#: Types accepted as image inputs for remix/edit.
#: When Pillow is available this also includes PIL.Image.Image.
ImageInput = str | bytes | Any


def encode_image(img: ImageInput) -> str:
    """Convert an image input to a base64-encoded string.

    Args:
        img: An image as a file path (str), raw bytes, or PIL Image.

    Returns:
        Base64-encoded string of the image data.

    Raises:
        TypeError: If ``img`` is not a supported type.
    """
    if isinstance(img, str):
        with open(img, "rb") as f:
            data = f.read()
    elif isinstance(img, bytes):
        data = img
    elif _HAS_PIL and isinstance(img, _PILImage.Image):
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
    else:
        raise TypeError(
            "Image must be a file path (str), bytes, or PIL.Image; got {}".format(
                type(img).__name__
            )
        )
    return base64.b64encode(data).decode("ascii")


def _resolve_client(client: ReveClient | None) -> ReveClient:
    """Return the given client or create a default one from environment."""
    return client if client is not None else ReveClient()


def _parse_image_response(raw_bytes: bytes, headers: Any) -> ImageResponse:
    """Parse raw image bytes and response headers into an ImageResponse.

    Raises:
        ReveContentViolationError: If the response indicates a content violation.
    """
    content_violation = headers.get("x-reve-content-violation", "").lower() in {
        "true",
        "1",
        "yes",
    }
    if content_violation:
        raise ReveContentViolationError(message="Content violation detected in response")

    metadata = {
        "request_id": headers.get("x-reve-request-id"),
        "credits_used": headers.get("x-reve-credits-used"),
        "credits_remaining": headers.get("x-reve-credits-remaining"),
        "version": headers.get("x-reve-version"),
        "content_violation": content_violation,
    }
    return ImageResponse.from_raw(image_bytes=raw_bytes, metadata=metadata)


_INTERNAL_KEYS = frozenset(("client", "reference_images", "reference_image"))


def _build_body(params: dict[str, Any]) -> dict[str, Any]:
    """Build a JSON body dict, excluding internal keys and None values."""
    return {k: v for k, v in params.items() if k not in _INTERNAL_KEYS and v is not None}


def _post_image(client: ReveClient | None, path: str, body: dict[str, Any]) -> ImageResponse:
    """Send a POST request for image generation and parse the response."""
    resolved = _resolve_client(client)
    raw_bytes, headers = resolved.post(path, body, accept="image/png")
    return _parse_image_response(raw_bytes, headers)


def create(
    prompt: str,
    *,
    client: ReveClient | None = None,
    **options: Any,
) -> ImageResponse:
    """Generate an image from a text prompt.

    Args:
        prompt: Text description of the image to generate.
        client: Pre-configured :class:`~reve._client.ReveClient`. If ``None``,
            a default client is created from environment variables.
        **options: Generation options forwarded to the API body. Supported
            keys: ``aspect_ratio``, ``version``, ``test_time_scaling``,
            ``postprocessing``.

    Returns:
        An :class:`~reve._response.ImageResponse` containing the generated
        PIL Image and response metadata (request_id, credits_used, etc.).

    Raises:
        ReveAPIError: For API errors (auth, budget, rate-limit, validation).
        ReveContentViolationError: If the generated content violates policies.
    """
    body = _build_body({**options, "prompt": prompt})
    return _post_image(client, "/v1/image/create/", body)


def remix(
    prompt: str,
    reference_images: Sequence[ImageInput],
    *,
    client: ReveClient | None = None,
    **options: Any,
) -> ImageResponse:
    """Generate a new image by remixing reference images with a text prompt.

    Reference images can be referred to in the prompt using ``<ref>0</ref>``,
    ``<ref>1</ref>``, etc.

    Args:
        prompt: Text prompt describing the desired output.
        reference_images: Sequence of reference images (file path, bytes, or
            PIL Image).
        client: Pre-configured :class:`~reve._client.ReveClient`.
        **options: Generation options (see :func:`create`).

    Returns:
        An :class:`~reve._response.ImageResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
        TypeError: If a reference image has an unsupported type.
    """
    body = _build_body({**options, "prompt": prompt})
    body["reference_images"] = [encode_image(img) for img in reference_images]
    return _post_image(client, "/v1/image/remix/", body)


def edit(
    edit_instruction: str,
    reference_image: ImageInput,
    *,
    client: ReveClient | None = None,
    **options: Any,
) -> ImageResponse:
    """Edit an existing image using a natural-language instruction.

    Args:
        edit_instruction: A description of the edit to apply.
        reference_image: The source image (file path, bytes, or PIL Image).
        client: Pre-configured :class:`~reve._client.ReveClient`.
        **options: Generation options (see :func:`create`).

    Returns:
        An :class:`~reve._response.ImageResponse`.

    Raises:
        ReveAPIError: For API errors.
        ReveContentViolationError: If the content violates policies.
        TypeError: If the reference image has an unsupported type.
    """
    body = _build_body({**options, "edit_instruction": edit_instruction})
    body["reference_image"] = encode_image(reference_image)
    return _post_image(client, "/v1/image/edit/", body)


def get_balance(*, client: ReveClient | None = None) -> dict[str, Any]:
    """Get the current credit balance.

    Args:
        client: Pre-configured :class:`~reve._client.ReveClient`.

    Returns:
        A dict with ``budget_id`` (str) and ``new_balance`` (number) keys.

    Raises:
        ReveAuthenticationError: If the API token is invalid (HTTP 401).
        ReveAPIError: For other API errors.
    """
    return _resolve_client(client).get("/api/misc/balance/")


def list_effects(
    source: str | None = None,
    *,
    client: ReveClient | None = None,
) -> list[dict[str, Any]]:
    """List available effects for postprocessing.

    Args:
        source: Filter effects by source (``"all"``, ``"project"``, ``"preset"``).
        client: Pre-configured :class:`~reve._client.ReveClient`.

    Returns:
        A list of effect dicts with ``name``, ``description``, ``source``,
        and ``category`` keys.

    Raises:
        ReveAuthenticationError: If the API token is invalid (HTTP 401).
        ReveAPIError: For other API errors.
    """
    resolved = _resolve_client(client)
    params: dict[str, str] | None = None
    if source is not None:
        params = {"source": source}
    resp = resolved.get("/v1/image/effect/", params=params)
    return resp.get("effects", [])
