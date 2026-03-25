"""Exception classes for the Reve Python SDK."""


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
    """

    _default_message: str = "API error"
    _default_status_code: int | None = None

    def __init__(
        self,
        message: str | None = None,
        status_code: int | None = None,
        **kwargs: str | None,
    ) -> None:
        self.message = message or self._default_message
        self.status_code = status_code if status_code is not None else self._default_status_code
        self.error_code: str | None = kwargs.get("error_code")
        self.instance_id: str | None = kwargs.get("instance_id")
        self.request_id: str | None = kwargs.get("request_id")
        super().__init__(self.message)

    def __str__(self) -> str:
        parts = []
        if self.status_code is not None:
            parts.append("status={}".format(self.status_code))
        if self.error_code is not None:
            parts.append("error_code={}".format(self.error_code))
        if self.instance_id is not None:
            parts.append("instance_id={}".format(self.instance_id))
        if self.request_id is not None:
            parts.append("request_id={}".format(self.request_id))
        parts.append(self.message)
        return " ".join(parts)


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

    def __str__(self) -> str:
        base = super().__str__()
        if self.retry_after is not None:
            return "{} (retry_after={})".format(base, self.retry_after)
        return base


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
