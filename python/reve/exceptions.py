"""Exception classes for the Reve Python SDK."""

import json
from typing import Any


class ReveAPIError(Exception):
    """Base exception for all Reve API errors.

    Subclasses set ``_default_message`` and ``_default_status_code`` as class
    variables so they can rely on the shared ``__init__`` without duplication.

    Attributes:
        message: Human-readable error description.
        status_code: HTTP status code that triggered the error, if any.
        error_code: Machine-readable error code from the API, if any.
        instance_id: Server-generated error instance ID for log correlation.
        request_id: Request ID from the x-reve-request-id header.
        log: Server-side debug log string, when the API returns one.
        params: Structured, error-specific parameters from the API, when
            present (e.g. the offending field for a validation error).
        context: List of nested error responses the API attached for
            additional context, when present.
        cause: The underlying cause the API attached to the error, when
            present.
        payload: The raw inner payload that triggered the error (e.g. an
            unexpected response body fragment), kept inspectable for
            debugging. ``None`` when not applicable.
    """

    _default_message: str = "API error"
    _default_status_code: int | None = None

    def __init__(
        self,
        message: str | None = None,
        status_code: int | None = None,
        payload: Any = None,
        **kwargs: Any,
    ) -> None:
        self.message = message or self._default_message
        self.status_code = status_code if status_code is not None else self._default_status_code
        self.payload = payload
        self.error_code: str | None = kwargs.get("error_code")
        self.instance_id: str | None = kwargs.get("instance_id")
        self.request_id: str | None = kwargs.get("request_id")
        self.log: str | None = kwargs.get("log")
        self.params: Any = kwargs.get("params")
        self.context: Any = kwargs.get("context")
        self.cause: Any = kwargs.get("cause")
        super().__init__(self.message)

    def _error_payload(self) -> dict[str, Any]:
        """Build the error payload dict, omitting keys whose value is ``None``.

        Subclasses that carry extra fields (e.g. ``retry_after``) override this
        to add them so both ``__str__`` and ``__repr__`` include them.
        """
        payload = {
            "message": self.message,
            "status_code": self.status_code,
            "error_code": self.error_code,
            "instance_id": self.instance_id,
            "request_id": self.request_id,
            "log": self.log,
            "params": self.params,
            "context": self.context,
            "cause": self.cause,
            "payload": self.payload,
        }
        return {k: v for k, v in payload.items() if v is not None}

    def __str__(self) -> str:
        return json.dumps(self._error_payload())

    def __repr__(self) -> str:
        return repr(self._error_payload())


class ReveAuthenticationError(ReveAPIError):
    """Raised when authentication fails (HTTP 401).

    This typically means the API token is missing, expired, or invalid.
    """

    _default_message = "Authentication failed"
    _default_status_code = 401


class ReveBudgetExhaustedError(ReveAPIError):
    """Raised when the credit budget is exhausted (HTTP 402).

    Check your balance with :func:`reve.v1.image.get_balance` and
    top up credits to continue.
    """

    _default_message = "Budget exhausted"
    _default_status_code = 402


class ReveRateLimitError(ReveAPIError):
    """Raised when the rate limit is exceeded (HTTP 429).

    Attributes:
        retry_after: Seconds to wait before retrying, if provided by the API.
    """

    _default_message = "Rate limit exceeded"
    _default_status_code = 429

    def __init__(self, retry_after: float | str | None = None, **kwargs) -> None:
        self.retry_after = retry_after
        super().__init__(**kwargs)

    def _error_payload(self) -> dict[str, Any]:
        payload = super()._error_payload()
        if self.retry_after is not None:
            payload["retry_after"] = self.retry_after
        return payload


class ReveContentViolationError(ReveAPIError):
    """Raised when the content violates safety policies.

    This can occur either on input (prompt/images) or on the generated output.
    """

    _default_message = "Content violation detected"


class ReveValidationError(ReveAPIError):
    """Raised when the request fails validation (HTTP 400).

    Check the ``message`` attribute for details on which parameter was invalid.
    """

    _default_message = "Validation error"
    _default_status_code = 400
