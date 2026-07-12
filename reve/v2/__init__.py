"""Reve API v2 module — the layout-aware image API.

The v2 endpoints accept and return a structured :class:`~reve.v2.types.Layout`
(a list of labelled, bounded :class:`~reve.v2.types.Region` s) alongside any
:class:`~reve.v2.types.Reference` images, rather than free-text image
references.

The entry points live in :mod:`reve.v2.image` (``create``, ``extract_layout``,
``create_layout``, and ``render_layout``); import them from there,
e.g. ``from reve.v2.image import create``. The data structures are re-exported
here for convenience and also live in :mod:`reve.v2.types`.
"""

from .types import (
    Bbox,
    BboxOrPoint,
    ImageInput,
    Layout,
    LayoutCommand,
    LayoutCommandOp,
    Point,
    Reference,
    Region,
    RegionType,
    V2ImageResponse,
    V2LayoutResponse,
)

__all__ = [
    "Bbox",
    "BboxOrPoint",
    "ImageInput",
    "Layout",
    "LayoutCommand",
    "LayoutCommandOp",
    "Point",
    "Reference",
    "Region",
    "RegionType",
    "V2ImageResponse",
    "V2LayoutResponse",
]
