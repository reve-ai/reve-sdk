"""Tests for reve.v1.image module."""

import base64
import io
import json

import pytest
import responses
from PIL import Image

from reve import ImageResponse, ReveClient
from reve.exceptions import ReveContentViolationError
from reve.v1.image import create, edit, encode_image, get_balance, list_effects, remix

_CREDITS_USED = 10
_EXPECTED_BALANCE = 500


def _make_jpeg_bytes(width=100, height=100):
    """Create minimal JPEG bytes for testing."""
    img = Image.new("RGB", (width, height), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


_FAKE_JPEG = _make_jpeg_bytes()
_BASE_URL = "https://api.reve.com"
_IMAGE_HEADERS = {
    "x-reve-request-id": "req-test",
    "x-reve-credits-used": "10",
    "x-reve-credits-remaining": "90",
    "x-reve-version": "v2.0",
    "x-reve-content-violation": "false",
}

_TEST_CLIENT = ReveClient(api_token="tok")


class TestEncodeImage:
    @staticmethod
    def test_encode_bytes():
        result = encode_image(b"hello")
        assert base64.b64decode(result) == b"hello"

    @staticmethod
    def test_encode_pil_image():
        img = Image.new("RGB", (10, 10), color="green")
        result = encode_image(img)
        decoded = base64.b64decode(result)
        # Should be valid PNG bytes (encode_image saves as PNG)
        assert decoded[:4] == b"\x89PNG"

    @staticmethod
    def test_encode_file_path(tmp_path):
        p = tmp_path / "test.jpg"
        p.write_bytes(b"fake-image-data")
        result = encode_image(str(p))
        assert base64.b64decode(result) == b"fake-image-data"

    @staticmethod
    def test_encode_invalid_type():
        with pytest.raises(TypeError):
            encode_image(12345)


class TestCreate:
    @staticmethod
    @responses.activate
    def test_create_basic():
        responses.add(
            responses.POST,
            _BASE_URL + "/v1/image/create/",
            body=_FAKE_JPEG,
            status=200,
            headers=_IMAGE_HEADERS,
        )
        result = create(prompt="A sunset", client=_TEST_CLIENT)
        assert isinstance(result, ImageResponse)
        assert result.request_id == "req-test"
        assert result.credits_used == _CREDITS_USED

        body = json.loads(responses.calls[0].request.body)
        assert body["prompt"] == "A sunset"

    @staticmethod
    @responses.activate
    def test_create_with_options():
        responses.add(
            responses.POST,
            _BASE_URL + "/v1/image/create/",
            body=_FAKE_JPEG,
            status=200,
            headers=_IMAGE_HEADERS,
        )
        create(
            prompt="A dragon",
            aspect_ratio="16:9",
            version="latest",
            postprocessing=[{"process": "upscale", "upscale_factor": 2}],
            client=_TEST_CLIENT,
        )
        body = json.loads(responses.calls[0].request.body)
        assert body["aspect_ratio"] == "16:9"
        assert body["postprocessing"] == [{"process": "upscale", "upscale_factor": 2}]


def _mock_and_call_image_endpoint(endpoint_url, call_fn):
    """Register a mock response for an image endpoint and invoke call_fn."""
    responses.add(
        responses.POST,
        _BASE_URL + endpoint_url,
        body=_FAKE_JPEG,
        status=200,
        headers=_IMAGE_HEADERS,
    )
    result = call_fn()
    assert isinstance(result, ImageResponse)
    return json.loads(responses.calls[0].request.body)


class TestRemix:
    @staticmethod
    @responses.activate
    def test_remix_with_bytes():
        body = _mock_and_call_image_endpoint(
            "/v1/image/remix/",
            lambda: remix(
                prompt="A person in a forest", reference_images=[b"fake-img"], client=_TEST_CLIENT
            ),
        )
        assert "reference_images" in body
        assert len(body["reference_images"]) == 1


class TestEdit:
    @staticmethod
    @responses.activate
    def test_edit_with_bytes():
        body = _mock_and_call_image_endpoint(
            "/v1/image/edit/",
            lambda: edit(
                edit_instruction="Make sky dramatic",
                reference_image=b"fake-img",
                client=_TEST_CLIENT,
            ),
        )
        assert body["edit_instruction"] == "Make sky dramatic"
        assert "reference_image" in body


class TestGetBalance:
    @staticmethod
    @responses.activate
    def test_get_balance():
        responses.add(
            responses.GET,
            _BASE_URL + "/api/misc/balance/",
            json={"budget_id": "b1", "new_balance": 500},
            status=200,
        )
        result = get_balance(client=_TEST_CLIENT)
        assert result["budget_id"] == "b1"
        assert result["new_balance"] == _EXPECTED_BALANCE


class TestListEffects:
    @staticmethod
    @responses.activate
    def test_list_effects():
        effects_data = [
            {"name": "sepia", "description": "Sepia tone", "source": "preset", "category": "color"},
        ]
        responses.add(
            responses.GET,
            _BASE_URL + "/v1/image/effect/",
            json={"effects": effects_data},
            status=200,
        )
        result = list_effects(client=_TEST_CLIENT)
        assert len(result) == 1
        assert result[0]["name"] == "sepia"

    @staticmethod
    @responses.activate
    def test_list_effects_with_source():
        responses.add(
            responses.GET,
            _BASE_URL + "/v1/image/effect/",
            json={"effects": []},
            status=200,
        )
        result = list_effects(source="project", client=_TEST_CLIENT)
        assert result == []
        assert "source=project" in responses.calls[0].request.url


class TestContentViolation:
    @staticmethod
    @responses.activate
    def test_content_violation_raises():
        violation_headers = dict(_IMAGE_HEADERS)
        violation_headers["x-reve-content-violation"] = "true"
        responses.add(
            responses.POST,
            _BASE_URL + "/v1/image/create/",
            body=_FAKE_JPEG,
            status=200,
            headers=violation_headers,
        )
        with pytest.raises(ReveContentViolationError):
            create(prompt="bad content", client=_TEST_CLIENT)
