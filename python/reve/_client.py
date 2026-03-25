"""HTTP client for the Reve API."""

import http
import os
from typing import Any

import requests as _requests

from .exceptions import (
    ReveAPIError,
    ReveAuthenticationError,
    ReveBudgetExhaustedError,
    ReveRateLimitError,
    ReveValidationError,
)

_DEFAULT_API_URL = "https://api.reve.com"


class ReveClient:
    """Low-level HTTP client for the Reve API.

    Handles authentication, base URL resolution, and error mapping.

    Args:
        api_token: Bearer token. Falls back to the ``REVE_API_TOKEN``
            environment variable if not provided.
        api_url: Base API URL. Falls back to ``REVE_API_HOST``
            env var, then defaults to ``https://api.reve.com``.
        proxy_authorization: Optional proxy-authorization header value
            (e.g. for Google IAP). Falls back to
            ``REVE_PROXY_AUTHORIZATION`` env var.
        verify: SSL certificate verification. Pass ``False`` to disable
            SSL verification (e.g. for local development). Defaults to
            ``True``.
    """

    def __init__(
        self,
        api_token: str | None = None,
        api_url: str | None = None,
        proxy_authorization: str | None = None,
        verify: bool = True,
    ) -> None:
        self.api_token: str | None = api_token or os.environ.get("REVE_API_TOKEN")
        self.api_url: str = api_url or os.environ.get("REVE_API_HOST") or _DEFAULT_API_URL
        # Strip trailing slash from base URL to avoid double slashes
        self.api_url = self.api_url.rstrip("/")
        self.proxy_authorization: str | None = proxy_authorization or os.environ.get(
            "REVE_PROXY_AUTHORIZATION"
        )
        self.verify: bool = verify

    def _headers(self, accept: str = "application/json") -> dict[str, str]:
        """Build request headers including auth and accept type.

        Args:
            accept: Value for the Accept header.

        Returns:
            dict of HTTP headers.
        """
        headers: dict[str, str] = {"Accept": accept}
        if self.api_token:
            headers["Authorization"] = "Bearer {}".format(self.api_token)
        if self.proxy_authorization:
            headers["proxy-authorization"] = self.proxy_authorization
        return headers

    @staticmethod
    def _parse_error_body(response: _requests.Response) -> dict:
        """Extract error body fields from a response."""
        try:
            body = response.json()
        except ValueError:
            body = {}
        message = body.get("message") or body.get("error") or response.text
        return {
            "message": message,
            "error_code": body.get("error_code"),
            "instance_id": body.get("instance_id"),
            "request_id": response.headers.get("x-reve-request-id"),
        }

    @staticmethod
    def _parse_retry_after(response: _requests.Response) -> float | str | None:
        """Parse Retry-After header, converting to float if possible."""
        retry_after: float | str | None = response.headers.get("Retry-After")
        if retry_after is not None:
            try:
                retry_after = float(retry_after)
            except (ValueError, TypeError):
                pass
        return retry_after

    #: Maps HTTP status codes to their corresponding exception classes.
    _STATUS_EXCEPTIONS: dict[int, type] = {
        400: ReveValidationError,
        401: ReveAuthenticationError,
        402: ReveBudgetExhaustedError,
    }

    def _handle_error(self, response: _requests.Response) -> None:
        """Raise an appropriate exception for error responses.

        Raises:
            ReveValidationError: For HTTP 400.
            ReveAuthenticationError: For HTTP 401.
            ReveBudgetExhaustedError: For HTTP 402.
            ReveRateLimitError: For HTTP 429.
            ReveAPIError: For all other error status codes.
        """
        info = self._parse_error_body(response)
        exc_class = self._STATUS_EXCEPTIONS.get(response.status_code)
        if exc_class:
            raise exc_class(**info)
        if response.status_code == http.HTTPStatus.TOO_MANY_REQUESTS:
            raise ReveRateLimitError(
                retry_after=self._parse_retry_after(response),
                **info,
            )
        raise ReveAPIError(status_code=response.status_code, **info)

    def post(
        self,
        path: str,
        data: dict[str, Any],
        accept: str = "application/json",
    ) -> dict[str, Any] | tuple[bytes, Any]:
        """Send a POST request to the Reve API.

        Args:
            path: API path (e.g. ``"/v1/image/create/"``).
            data: JSON-serializable request body.
            accept: Accept header value. Use ``"image/jpeg"`` for image
                endpoints.

        Returns:
            Parsed JSON dict if *accept* is ``"application/json"``, otherwise
            a tuple of ``(raw_bytes, response_headers)``.

        Raises:
            ReveAPIError: If the server returns an error status code.
        """
        url = self.api_url + path
        headers = self._headers(accept=accept)
        headers["Content-Type"] = "application/json"

        resp = _requests.post(url, json=data, headers=headers, verify=self.verify)

        if resp.status_code >= http.HTTPStatus.BAD_REQUEST:
            self._handle_error(resp)

        if accept == "application/json":
            return resp.json()

        # For image responses, return bytes + headers for metadata extraction
        return resp.content, resp.headers

    def get(
        self,
        path: str,
        params: dict[str, str] | None = None,
    ) -> Any:
        """Send a GET request to the Reve API.

        Args:
            path: API path (e.g. ``"/v1/image/balance/"``).
            params: Optional query parameters dict.

        Returns:
            Parsed JSON response.

        Raises:
            ReveAPIError: If the server returns an error status code.
        """
        url = self.api_url + path
        headers = self._headers(accept="application/json")

        resp = _requests.get(url, params=params, headers=headers, verify=self.verify)

        if resp.status_code >= http.HTTPStatus.BAD_REQUEST:
            self._handle_error(resp)

        return resp.json()
