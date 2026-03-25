"""Tests for reve._response module."""

import io

import pytest
from PIL import Image

from reve import ImageResponse

try:
    import pydantic  # noqa: PLC0415

    _HAS_PYDANTIC = True
except ImportError:
    _HAS_PYDANTIC = False

_CREDITS_USED = 5
_CREDITS_REMAINING = 95
_CREDITS_USED_STR = 42
_CREDITS_REMAINING_STR = 58


def _make_jpeg_bytes(width=100, height=100):
    """Create minimal JPEG bytes for testing."""
    img = Image.new("RGB", (width, height), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_image_response_basic():
    data = _make_jpeg_bytes(200, 150)
    resp = ImageResponse.from_raw(
        image_bytes=data,
        metadata={
            "request_id": "req-123",
            "credits_used": "5",
            "credits_remaining": "95",
            "version": "v2.1",
            "content_violation": False,
        },
    )
    assert resp.image.size == (200, 150)
    assert resp.image_bytes == data
    assert resp.request_id == "req-123"
    assert resp.credits_used == _CREDITS_USED
    assert resp.credits_remaining == _CREDITS_REMAINING
    assert resp.version == "v2.1"
    assert resp.content_violation is False


def test_image_response_none_credits():
    data = _make_jpeg_bytes()
    resp = ImageResponse.from_raw(image_bytes=data)
    assert resp.credits_used is None
    assert resp.credits_remaining is None
    assert resp.request_id is None
    assert resp.version is None
    assert resp.content_violation is False


def test_image_response_repr():
    data = _make_jpeg_bytes(320, 240)
    resp = ImageResponse.from_raw(
        image_bytes=data,
        metadata={"request_id": "req-abc"},
    )
    r = repr(resp)
    assert "req-abc" in r
    assert "320x240" in r


def test_image_response_save(tmp_path):
    data = _make_jpeg_bytes(50, 50)
    resp = ImageResponse.from_raw(
        image_bytes=data,
        metadata={"request_id": "req-save"},
    )
    out_path = tmp_path / "output.jpg"
    resp.save(str(out_path))
    assert out_path.exists()
    saved = Image.open(str(out_path))
    assert saved.size == (50, 50)


@pytest.mark.skipif(not _HAS_PYDANTIC, reason="pydantic not installed")
def test_image_response_is_pydantic_model():
    assert issubclass(ImageResponse, pydantic.BaseModel)


def test_image_response_coerces_string_credits():
    data = _make_jpeg_bytes()
    resp = ImageResponse.from_raw(
        image_bytes=data,
        metadata={"credits_used": "42", "credits_remaining": "58"},
    )
    assert resp.credits_used == _CREDITS_USED_STR
    assert resp.credits_remaining == _CREDITS_REMAINING_STR
    assert isinstance(resp.credits_used, int)
    assert isinstance(resp.credits_remaining, int)
