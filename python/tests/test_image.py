"""Tests for reve.v1.image module."""

import base64
import io
import json

import pytest
import responses
from PIL import Image

from reve import ImageResponse, ReveClient
from reve.exceptions import ReveAPIError, ReveContentViolationError, ReveValidationError
from reve.v1.image import create, edit, encode_image, get_balance, list_effects, remix
from reve.v2 import Bbox, Description, ImageInput, Reference, Region, V2ImageResponse
from reve.v2 import create as v2_create
from reve.v2 import edit as v2_edit

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
            _BASE_URL + "/v1/image/create",
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
            _BASE_URL + "/v1/image/create",
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
            "/v1/image/remix",
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
            "/v1/image/edit",
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
            _BASE_URL + "/api/misc/balance",
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
            _BASE_URL + "/v1/image/effect",
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
            _BASE_URL + "/v1/image/effect",
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
            _BASE_URL + "/v1/image/create",
            body=_FAKE_JPEG,
            status=200,
            headers=violation_headers,
        )
        with pytest.raises(ReveContentViolationError):
            create(prompt="bad content", client=_TEST_CLIENT)


_V2_CREDITS_USED = 120
_V2_CREDITS_REMAINING = 80


def _v2_json_response(content_violation=False, image_bytes=_FAKE_JPEG):
    """Build a v1_image_response-style JSON body for a v2 endpoint."""
    return {
        "image": base64.b64encode(image_bytes).decode("ascii"),
        "description": {
            "prompt": "two animals",
            "regions": [
                {
                    "label": "dog",
                    "prompt": "a dog",
                    "bbox": {"x0": 0.1, "y0": 0.1, "x1": 0.5, "y1": 0.5},
                },
            ],
        },
        "content_violation": content_violation,
        "request_id": "req-test",
        "credits_used": _V2_CREDITS_USED,
        "credits_remaining": _V2_CREDITS_REMAINING,
        "version": "latest",
    }


class TestV2Create:
    @staticmethod
    @responses.activate
    def test_create_with_layout():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create",
            json=_v2_json_response(),
            status=200,
        )
        description = Description(
            prompt="two animals",
            regions=[
                Region(label="dog", prompt="a dog", bbox=Bbox(0.1, 0.1, 0.5, 0.5)),
            ],
        )
        result = v2_create(
            instruction="A dog and a cat",
            description=description,
            references=[Reference(image=ImageInput(data=b"fake-img"), prompt="ref")],
            aspect_ratio="1:1",
            client=_TEST_CLIENT,
        )
        assert isinstance(result, V2ImageResponse)
        assert result.request_id == "req-test"
        assert result.credits_used == _V2_CREDITS_USED
        assert result.image_bytes == _FAKE_JPEG
        assert result.description is not None
        assert result.description.regions[0].label == "dog"
        assert result.description.regions[0].bbox.x1 == 0.5

        body = json.loads(responses.calls[0].request.body)
        assert body["instruction"] == "A dog and a cat"
        assert body["aspect_ratio"] == "1:1"
        assert body["description"]["regions"][0]["bbox"]["x0"] == 0.1
        assert body["references"][0]["prompt"] == "ref"
        assert "data" in body["references"][0]["image"]

    @staticmethod
    @responses.activate
    def test_create_minimal_omits_optional_fields():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create",
            json=_v2_json_response(),
            status=200,
        )
        v2_create(instruction="A sunset", client=_TEST_CLIENT)
        body = json.loads(responses.calls[0].request.body)
        assert body == {"instruction": "A sunset"}


class TestV2Edit:
    @staticmethod
    @responses.activate
    def test_edit_with_raw_image():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/edit",
            json=_v2_json_response(),
            status=200,
        )
        result = v2_edit(
            instruction="Make it night",
            image=b"fake-img",
            new_description=Description(
                regions=[Region(label="sky", prompt="dark sky", bbox=Bbox(0.0, 0.0, 1.0, 0.5))],
            ),
            client=_TEST_CLIENT,
        )
        assert isinstance(result, V2ImageResponse)
        body = json.loads(responses.calls[0].request.body)
        assert body["instruction"] == "Make it night"
        assert "data" in body["image"]
        assert body["new_description"]["regions"][0]["label"] == "sky"
        assert "old_description" not in body


class TestV2ContentViolation:
    @staticmethod
    @responses.activate
    def test_content_violation_raises():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create",
            json=_v2_json_response(content_violation=True),
            status=200,
        )
        with pytest.raises(ReveContentViolationError):
            v2_create(instruction="bad content", client=_TEST_CLIENT)


class TestV2ImageInput:
    @staticmethod
    def test_to_dict_with_data_only():
        assert ImageInput(data=b"img").to_dict() == {"data": base64.b64encode(b"img").decode()}

    @staticmethod
    def test_to_dict_with_ref_only():
        assert ImageInput(ref="id:1234").to_dict() == {"ref": "id:1234"}

    @staticmethod
    def test_to_dict_with_both_raises():
        with pytest.raises(ReveValidationError):
            ImageInput(data=b"img", ref="id:1234").to_dict()

    @staticmethod
    def test_to_dict_with_neither_raises():
        with pytest.raises(ReveValidationError):
            ImageInput().to_dict()


class TestV2ResponseParsing:
    @staticmethod
    def test_malformed_base64_image_raises_api_error():
        body = _v2_json_response()
        body["image"] = "not-valid-base64!!!"
        with pytest.raises(ReveAPIError):
            V2ImageResponse.from_json(body)

    @staticmethod
    def test_non_dict_description_raises_api_error():
        body = _v2_json_response()
        body["description"] = "x" * 80
        with pytest.raises(ReveAPIError) as exc_info:
            V2ImageResponse.from_json(body)
        assert exc_info.value.payload == "x" * 80
        assert "x" * 50 in exc_info.value.message
        assert "x" * 51 not in exc_info.value.message
