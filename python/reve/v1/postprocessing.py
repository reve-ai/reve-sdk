"""Postprocessing helper functions for building postprocessing pipelines.

These functions return dicts that can be passed in the ``postprocessing``
list of image generation calls.

Example::

    from reve.v1.postprocessing import upscale, remove_background

    img = create(
        prompt="A red dragon",
        postprocessing=[upscale(factor=2), remove_background()],
    )
"""

from typing import Any


def upscale(factor: int = 2) -> dict[str, Any]:
    """Upscale the generated image by a given factor.

    Args:
        factor: Upscale multiplier (default 2).

    Returns:
        A postprocessing operation dict suitable for the ``postprocessing``
        parameter of image generation functions.
    """
    return {"process": "upscale", "upscale_factor": factor}


def remove_background() -> dict[str, Any]:
    """Remove the image background, producing a transparent PNG.

    Returns:
        A postprocessing operation dict suitable for the ``postprocessing``
        parameter of image generation functions.
    """
    return {"process": "remove_background"}


def fit_image(
    max_width: int | None = None,
    max_height: int | None = None,
    max_dim: int | None = None,
) -> dict[str, Any]:
    """Constrain image dimensions to fit within given bounds.

    At least one constraint should be provided.

    Args:
        max_width: Maximum width in pixels (1–4096).
        max_height: Maximum height in pixels (1–4096).
        max_dim: Maximum dimension for both width and height (1–4096).

    Returns:
        A postprocessing operation dict suitable for the ``postprocessing``
        parameter of image generation functions.
    """
    result: dict[str, Any] = {"process": "fit_image"}
    if max_width is not None:
        result["max_width"] = max_width
    if max_height is not None:
        result["max_height"] = max_height
    if max_dim is not None:
        result["max_dim"] = max_dim
    return result


def effect(name: str, parameters: dict[str, Any] | None = None) -> dict[str, Any]:
    """Apply a named effect to the generated image.

    Use :func:`reve.v1.image.list_effects` to discover available effect names.

    Args:
        name: Effect name (e.g. ``"sepia"``, ``"blur"``).
        parameters: Optional dict of effect-specific parameters.

    Returns:
        A postprocessing operation dict suitable for the ``postprocessing``
        parameter of image generation functions.
    """
    result: dict[str, Any] = {"process": "effect", "effect_name": name}
    if parameters is not None:
        result["effect_parameters"] = parameters
    return result
