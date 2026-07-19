"""Tests for reve.v1.image module."""

import base64
import inspect
import io
import json
from typing import Any

import pytest
import responses
from PIL import Image

from reve import ImageResponse, ReveClient
from reve.exceptions import ReveAPIError, ReveContentViolationError, ReveValidationError
from reve.v1.image import create, edit, encode_image, get_balance, list_effects, remix
from reve.v2 import image as v2_image
from reve.v2.image import create as v2_create
from reve.v2.image import create_layout, extract_layout, render_layout
from reve.v2.types import (
    Bbox,
    ImageInput,
    Layout,
    LayoutCommand,
    Point,
    Reference,
    Region,
    V2ImageResponse,
    V2LayoutResponse,
)

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
    """Build an image-producing v1_image_response-style JSON body for a v2 endpoint."""
    return {
        "image": base64.b64encode(image_bytes).decode("ascii"),
        "layout": {
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


def _v2_layout_json_response(content_violation=False, normalized_edit_instruction=None):
    """Build a layout-producing v1_image_response-style JSON body (no image).

    Pass ``normalized_edit_instruction`` explicitly to model a layout-editing
    response, and leave it unset for extraction or prompt-only layout creation.
    """
    layout: dict[str, Any] = {
        "prompt": "a reading nook",
        "regions": [
            {
                "label": "chair",
                "prompt": "an armchair",
                "bbox": {"x0": 0.1, "y0": 0.3, "x1": 0.4, "y1": 0.9},
                "region_type": "coarse_detail",
            },
        ],
        "width": 3072,
        "height": 2560,
    }
    if normalized_edit_instruction is not None:
        layout["normalized_edit_instruction"] = normalized_edit_instruction
    return {
        "layout": layout,
        "content_violation": content_violation,
        "request_id": "req-test",
        "credits_used": _V2_CREDITS_USED,
        "credits_remaining": _V2_CREDITS_REMAINING,
        "version": "latest",
    }


class TestV2Create:
    @staticmethod
    @responses.activate
    def test_create_with_references():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create",
            json=_v2_json_response(),
            status=200,
        )
        result = v2_create(
            prompt="A dog and a cat",
            references=[ImageInput(data=b"fake-img")],
            aspect_ratio="1:1",
            client=_TEST_CLIENT,
        )
        assert isinstance(result, V2ImageResponse)
        assert result.request_id == "req-test"
        assert result.credits_used == _V2_CREDITS_USED
        assert result.image_bytes == _FAKE_JPEG
        # The response still echoes the layout the model generated.
        assert result.layout is not None
        assert result.layout.regions[0].label == "dog"
        assert result.layout.regions[0].bbox.x1 == 0.5

        body = json.loads(responses.calls[0].request.body)
        assert body["prompt"] == "A dog and a cat"
        assert body["aspect_ratio"] == "1:1"
        assert "layout" not in body
        assert "data" in body["references"][0]

    @staticmethod
    @responses.activate
    def test_create_minimal_omits_optional_fields():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create",
            json=_v2_json_response(),
            status=200,
        )
        v2_create(prompt="A sunset", client=_TEST_CLIENT)
        body = json.loads(responses.calls[0].request.body)
        assert body == {"prompt": "A sunset"}


class TestV2CreateWithReferences:
    @staticmethod
    @responses.activate
    def test_create_preserves_reference_order():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create",
            json=_v2_json_response(),
            status=200,
        )
        result = v2_create(
            prompt="Make it night",
            references=[b"base-img", ImageInput(ref="reference:@lighting")],
            client=_TEST_CLIENT,
        )
        assert isinstance(result, V2ImageResponse)
        body = json.loads(responses.calls[0].request.body)
        assert body["prompt"] == "Make it night"
        assert base64.b64decode(body["references"][0]["data"]) == b"base-img"
        assert body["references"][1] == {"ref": "reference:@lighting"}
        assert "image" not in body


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
            v2_create(prompt="bad content", client=_TEST_CLIENT)


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
    def test_non_dict_layout_raises_api_error():
        body = _v2_json_response()
        body["layout"] = "x" * 80
        with pytest.raises(ReveAPIError) as exc_info:
            V2ImageResponse.from_json(body)
        assert exc_info.value.payload == "x" * 80
        assert "x" * 50 in exc_info.value.message
        assert "x" * 51 not in exc_info.value.message


class TestV2RenderLayout:
    @staticmethod
    @responses.activate
    def test_render_layout_with_references():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/render_layout",
            json=_v2_json_response(),
            status=200,
        )
        layout = Layout(
            regions=[Region(label="sky", prompt="blue sky", bbox=Bbox(0.0, 0.0, 1.0, 0.5))]
        )
        result = render_layout(
            layout=layout,
            references=[Reference(image=ImageInput(data=b"fake-img"))],
            client=_TEST_CLIENT,
        )
        assert isinstance(result, V2ImageResponse)
        assert result.image_bytes == _FAKE_JPEG
        body = json.loads(responses.calls[0].request.body)
        assert body["layout"]["regions"][0]["label"] == "sky"
        assert "width" not in body["layout"]
        assert "height" not in body["layout"]
        assert "aspect_ratio" not in body
        assert "data" in body["references"][0]["image"]

    @staticmethod
    @responses.activate
    def test_render_layout_sends_layout_dimensions():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/render_layout",
            json=_v2_json_response(),
            status=200,
        )
        layout = Layout(
            regions=[Region(label="sky", prompt="blue sky", bbox=Bbox(0.0, 0.0, 1.0, 0.5))],
            width=3072,
            height=2560,
        )
        render_layout(layout=layout, client=_TEST_CLIENT)
        body = json.loads(responses.calls[0].request.body)
        assert body["layout"]["width"] == 3072
        assert body["layout"]["height"] == 2560


class TestV2ExtractLayout:
    @staticmethod
    @responses.activate
    @pytest.mark.parametrize("prompt", [None, "Remove the chair"])
    def test_extract_layout(prompt):
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/extract_layout",
            json=_v2_layout_json_response(),
            status=200,
        )
        result = extract_layout(image=b"fake-img", prompt=prompt, client=_TEST_CLIENT)
        assert isinstance(result, V2LayoutResponse)
        assert result.layout is not None
        assert result.layout.regions[0].region_type == "coarse_detail"
        assert result.layout.width == 3072
        assert result.layout.height == 2560
        body = json.loads(responses.calls[0].request.body)
        assert "data" in body["image"]
        assert body.get("prompt") == prompt
        assert "aspect_ratio" not in body


class TestV2CreateLayout:
    @staticmethod
    @responses.activate
    def test_create_layout_from_prompt():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create_layout",
            json=_v2_layout_json_response(),
            status=200,
        )
        result = create_layout(prompt="a reading nook", client=_TEST_CLIENT)
        assert isinstance(result, V2LayoutResponse)
        assert result.layout is not None
        body = json.loads(responses.calls[0].request.body)
        assert body == {"prompt": "a reading nook"}

    @staticmethod
    @responses.activate
    def test_create_layout_with_references_and_commands():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create_layout",
            json=_v2_layout_json_response(),
            status=200,
        )
        layout = Layout(
            regions=[Region(label="chair", prompt="a chair", bbox=Bbox(0.1, 0.3, 0.4, 0.9))]
        )
        result = create_layout(
            references=[
                Reference(image=ImageInput(data=b"fake-img"), prompt="ref"),
                Reference(layout=layout),
            ],
            commands=[LayoutCommand(op="add", description="a lamp")],
            aspect_ratio="3:2",
            client=_TEST_CLIENT,
        )
        assert isinstance(result, V2LayoutResponse)
        body = json.loads(responses.calls[0].request.body)
        assert "prompt" not in body
        assert body["aspect_ratio"] == "3:2"
        assert "data" in body["references"][0]["image"]
        assert body["references"][0]["prompt"] == "ref"
        # A layout-only reference carries no image.
        assert "image" not in body["references"][1]
        assert body["references"][1]["layout"]["regions"][0]["label"] == "chair"
        assert body["commands"] == [{"op": "add", "description": "a lamp"}]

    @staticmethod
    @responses.activate
    def test_create_layout_serializes_command_positions():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create_layout",
            json=_v2_layout_json_response(),
            status=200,
        )
        result = create_layout(
            prompt="a desk scene",
            references=[Reference(layout=Layout())],
            commands=[
                LayoutCommand(op="add", description="a lamp", at=Bbox(0.1, 0.1, 0.3, 0.4)),
                LayoutCommand(op="shift", label="mug", at=Point(0.5, 0.5), to=Point(0.7, 0.6)),
                LayoutCommand(op="change", label="book", new_description="an open notebook"),
            ],
            client=_TEST_CLIENT,
        )
        assert isinstance(result, V2LayoutResponse)
        body = json.loads(responses.calls[0].request.body)
        assert body["prompt"] == "a desk scene"
        assert body["commands"][0] == {
            "op": "add",
            "description": "a lamp",
            "at": {"x0": 0.1, "y0": 0.1, "x1": 0.3, "y1": 0.4},
        }
        assert body["commands"][1] == {
            "op": "shift",
            "label": "mug",
            "at": {"x": 0.5, "y": 0.5},
            "to": {"x": 0.7, "y": 0.6},
        }
        assert body["commands"][2] == {
            "op": "change",
            "label": "book",
            "new_description": "an open notebook",
        }


class TestV2PublicFunctions:
    @staticmethod
    def test_exposes_only_redesigned_function_names():
        assert list(inspect.signature(v2_image.create).parameters) == [
            "prompt",
            "references",
            "aspect_ratio",
            "postprocessing",
            "version",
            "client",
        ]
        assert list(inspect.signature(v2_image.extract_layout).parameters) == [
            "image",
            "prompt",
            "version",
            "client",
        ]
        assert list(inspect.signature(v2_image.create_layout).parameters) == [
            "prompt",
            "references",
            "commands",
            "aspect_ratio",
            "version",
            "client",
        ]
        assert list(inspect.signature(v2_image.render_layout).parameters) == [
            "layout",
            "references",
            "postprocessing",
            "version",
            "client",
        ]
        for obsolete in ("edit", "image_to_layout", "edit_layout", "render"):
            assert not hasattr(v2_image, obsolete)


class TestV2LayoutResponse:
    @staticmethod
    def test_from_json_parses_layout_only():
        resp = V2LayoutResponse.from_json(_v2_layout_json_response())
        assert resp.layout is not None
        assert resp.credits_used == _V2_CREDITS_USED
        assert resp.layout.regions[0].region_type == "coarse_detail"

    @staticmethod
    @responses.activate
    def test_content_violation_raises():
        responses.add(
            responses.POST,
            _BASE_URL + "/v2/image/create_layout",
            json=_v2_layout_json_response(content_violation=True),
            status=200,
        )
        with pytest.raises(ReveContentViolationError):
            create_layout(prompt="bad content", client=_TEST_CLIENT)


class TestV2RegionAndReference:
    @staticmethod
    def test_region_round_trip_with_parent_and_type():
        region = Region(
            label="face",
            prompt="a face",
            bbox=Bbox(0.1, 0.1, 0.3, 0.3),
            parent="person",
            region_type="face",
        )
        d = region.to_dict()
        assert d["parent"] == "person"
        assert d["region_type"] == "face"
        restored = Region.from_dict(d)
        assert restored.parent == "person"
        assert restored.region_type == "face"

    @staticmethod
    def test_region_omits_unset_optional_fields():
        d = Region(label="r", prompt="p", bbox=Bbox(0, 0, 1, 1)).to_dict()
        assert "parent" not in d
        assert "region_type" not in d

    @staticmethod
    def test_reference_serializes_layout():
        ref = Reference(
            image=ImageInput(ref="id:1234"),
            layout=Layout(regions=[Region(label="r", prompt="p", bbox=Bbox(0, 0, 1, 1))]),
        )
        d = ref.to_dict()
        assert d["image"] == {"ref": "id:1234"}
        assert d["layout"]["regions"][0]["label"] == "r"
