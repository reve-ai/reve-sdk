"""Reve API v2 module — layout-aware image create and edit.

The v2 endpoints accept a structured :class:`~reve.v2.types.Description`
layout and a list of :class:`~reve.v2.types.Reference` images rather than
free-text image references. See :mod:`reve.v2.image` for the entry points.
"""

from .image import create, edit
from .types import (
    Bbox,
    Description,
    ImageInput,
    Reference,
    Region,
    V2ImageResponse,
)

__all__ = [
    "create",
    "edit",
    "Bbox",
    "Description",
    "ImageInput",
    "Reference",
    "Region",
    "V2ImageResponse",
]
