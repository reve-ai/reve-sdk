"""Tests for reve._client module."""

import pytest
import responses

from reve import ReveClient
from reve.exceptions import (
    ReveAPIError,
    ReveAuthenticationError,
    ReveBudgetExhaustedError,
    ReveRateLimitError,
    ReveValidationError,
)

_RETRY_AFTER_SECONDS = 30.0
_SERVER_ERROR_STATUS = 500


class TestReveClientInit:
    @staticmethod
    def test_explicit_params():
        client = ReveClient(
            api_token="tok123",
            api_url="https://custom.api.com",
            proxy_authorization="proxy-val",
        )
        assert client.api_token == "tok123"
        assert client.api_url == "https://custom.api.com"
        assert client.proxy_authorization == "proxy-val"

    @staticmethod
    def test_env_vars(monkeypatch):
        monkeypatch.setenv("REVE_API_TOKEN", "env-tok")
        monkeypatch.setenv("REVE_API_HOST", "https://env.api.com")
        monkeypatch.setenv("REVE_PROXY_AUTHORIZATION", "env-proxy")
        client = ReveClient()
        assert client.api_token == "env-tok"
        assert client.api_url == "https://env.api.com"
        assert client.proxy_authorization == "env-proxy"

    @staticmethod
    def test_defaults(monkeypatch):
        monkeypatch.delenv("REVE_API_TOKEN", raising=False)
        monkeypatch.delenv("REVE_API_HOST", raising=False)
        monkeypatch.delenv("REVE_PROXY_AUTHORIZATION", raising=False)
        client = ReveClient()
        assert client.api_token is None
        assert client.api_url == "https://api.reve.com"
        assert client.proxy_authorization is None

    @staticmethod
    def test_trailing_slash_stripped():
        client = ReveClient(api_url="https://api.reve.com/")
        assert client.api_url == "https://api.reve.com"


class TestReveClientHeaders:
    @staticmethod
    def test_headers_with_auth():
        client = ReveClient(api_token="tok123")
        headers = client._headers()
        assert headers["Authorization"] == "Bearer tok123"
        assert headers["Accept"] == "application/json"

    @staticmethod
    def test_headers_with_proxy():
        client = ReveClient(api_token="tok", proxy_authorization="proxy-val")
        headers = client._headers()
        assert headers["proxy-authorization"] == "proxy-val"

    @staticmethod
    def test_headers_custom_accept():
        client = ReveClient(api_token="tok")
        headers = client._headers(accept="image/jpeg")
        assert headers["Accept"] == "image/jpeg"


class TestReveClientPost:
    @staticmethod
    @responses.activate
    def test_post_json():
        responses.add(
            responses.POST,
            "https://api.reve.com/v1/image/rating/",
            json={"ok": True},
            status=200,
        )
        client = ReveClient(api_token="tok")
        result = client.post("/v1/image/rating/", {"request_id": "r1", "rating": 80})
        assert result == {"ok": True}

    @staticmethod
    @responses.activate
    def test_post_image():
        responses.add(
            responses.POST,
            "https://api.reve.com/v1/image/create/",
            body=b"\xff\xd8\xff\xe0fake-jpeg",
            status=200,
            headers={"x-reve-request-id": "req-1"},
        )
        client = ReveClient(api_token="tok")
        raw, headers = client.post("/v1/image/create/", {"prompt": "test"}, accept="image/jpeg")
        assert raw == b"\xff\xd8\xff\xe0fake-jpeg"
        assert headers["x-reve-request-id"] == "req-1"


def _mock_post_error(json_body, status, headers=None):
    """Register a mock error response and POST to trigger it.

    Returns the raised exception for assertion.
    """
    responses.add(
        responses.POST,
        "https://api.reve.com/v1/test/",
        json=json_body,
        status=status,
        headers=headers or {},
    )
    client = ReveClient(api_token="tok")
    client.post("/v1/test/", {})


class TestReveClientErrors:
    @staticmethod
    @responses.activate
    @pytest.mark.parametrize(
        "status, message, expected_exc",
        [
            (401, "bad token", ReveAuthenticationError),
            (402, "no credits", ReveBudgetExhaustedError),
            (400, "bad input", ReveValidationError),
        ],
        ids=["401_auth", "402_budget", "400_validation"],
    )
    def test_http_error_raises_specific_exception(status, message, expected_exc):
        with pytest.raises(expected_exc) as exc_info:
            _mock_post_error(
                json_body={
                    "message": message,
                    "error_code": "TEST_ERROR",
                    "instance_id": "error-test-123",
                },
                status=status,
                headers={"x-reve-request-id": "req-test-456"},
            )
        assert exc_info.value.instance_id == "error-test-123"
        assert exc_info.value.request_id == "req-test-456"
        assert exc_info.value.error_code == "TEST_ERROR"

    @staticmethod
    @responses.activate
    @pytest.mark.parametrize(
        "exc_cls, mock_args, expected_attrs",
        [
            (
                ReveRateLimitError,
                {
                    "status": 429,
                    "json_body": {"message": "slow down", "instance_id": "error-429-def"},
                    "headers": {"Retry-After": "30", "x-reve-request-id": "req-429-ghi"},
                },
                {
                    "retry_after": _RETRY_AFTER_SECONDS,
                    "instance_id": "error-429-def",
                    "request_id": "req-429-ghi",
                },
            ),
            (
                ReveAPIError,
                {
                    "status": 500,
                    "json_body": {"message": "oops", "instance_id": "error-500-abc"},
                    "headers": {"x-reve-request-id": "req-500-xyz"},
                },
                {
                    "status_code": _SERVER_ERROR_STATUS,
                    "instance_id": "error-500-abc",
                    "request_id": "req-500-xyz",
                },
            ),
        ],
        ids=["429_rate_limit", "500_api_error"],
    )
    def test_error_with_metadata(exc_cls, mock_args, expected_attrs):
        with pytest.raises(exc_cls) as exc_info:
            _mock_post_error(**mock_args)
        for attr, expected in expected_attrs.items():
            assert getattr(exc_info.value, attr) == expected

    @staticmethod
    def test_error_str_includes_ids():
        exc = ReveAPIError(
            message="Something broke",
            status_code=500,
            error_code="INTERNAL",
            instance_id="error-test-abc",
            request_id="req-test-xyz",
        )
        s = str(exc)
        assert "instance_id=error-test-abc" in s
        assert "request_id=req-test-xyz" in s
        assert "error_code=INTERNAL" in s
        assert "Something broke" in s
