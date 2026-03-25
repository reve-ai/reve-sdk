---
name: reve-image
description: How to use the Reve Python SDK for image generation, remixing, and editing
---

# Reve Python SDK

The `reve` package is a Python client for the Reve image generation API.
Install it with `uv pip install reve`. It requires Python 3.10+.

## Authentication

Set the `REVE_API_TOKEN` environment variable, or pass `api_token=` when
constructing a `ReveClient`. Tokens look like `papi.xxx`.

```bash
export REVE_API_TOKEN="papi.your-token-here"
```

To create a Reve API token, go to `https://app.reve.com/account` and scroll to
the bottom. Click "Enable API." Once you accept the terms of service, add some
API credits to your budget and copy out the API token created for you.

Optional env vars: `REVE_API_HOST` (default `https://api.reve.com`),
`REVE_PROXY_AUTHORIZATION`.

## Core Functions

All image functions live in `reve.v1.image`.

### Create an image from a prompt

```python
from reve.v1.image import create

img = create(prompt="A red dragon flying over mountains")
img.save("dragon.jpg")
```

Options: `aspect_ratio` (`"16:9"`, `"3:2"`, `"4:3"`, `"1:1"`, `"3:4"`,
`"2:3"`, `"9:16"`, `"auto"`), `version`, `test_time_scaling` (1–5),
`postprocessing`.

### Remix with reference images

```python
from reve.v1.image import remix

img = remix(
    prompt="The subject from <ref>0</ref> in a magical forest",
    reference_images=["photo.jpg"],
    aspect_ratio="1:1",
)
```

Reference images accept file paths (str), raw bytes, or PIL Images (when Pillow is installed).
Use `<ref>0</ref>`, `<ref>1</ref>`, etc. in the prompt to refer to each image.

### Edit an existing image

```python
from reve.v1.image import edit

img = edit(
    edit_instruction="Make the sky more dramatic with storm clouds",
    reference_image="original.jpg",
)
```

### Check credit balance

```python
from reve.v1.image import get_balance

balance = get_balance()  # {"budget_id": "abc", "new_balance": 500}
```

### List available effects

```python
from reve.v1.image import list_effects

effects = list_effects(source="preset")  # "all", "project", or "preset"
```

## Postprocessing

Build pipelines with helpers from `reve.v1.postprocessing`:

```python
from reve.v1.image import create
from reve.v1.postprocessing import upscale, remove_background, fit_image, effect

img = create(
    prompt="A cat astronaut",
    postprocessing=[upscale(factor=2), remove_background()],
)
```

- `upscale(factor=2)` — enlarge the image
- `remove_background()` — transparent PNG output
- `fit_image(max_width=, max_height=, max_dim=)` — constrain dimensions (px, 1–4096)
- `effect(name, parameters=None)` — apply a named effect from `list_effects()`

## Response Object

`create()`, `remix()`, and `edit()` return an `ImageResponse` with:

- `image` — `PIL.Image.Image` when Pillow is installed, otherwise `None`
- `image_bytes` — `bytes` (raw image data, always populated)
- `request_id` — `str | None`
- `credits_used` — `int | None`
- `credits_remaining` — `int | None`
- `version` — `str | None`
- `content_violation` — `bool`
- `save(path, **kwargs)` — delegates to `PIL.Image.save()` when Pillow is available, otherwise writes raw bytes

## Error Handling

All exceptions inherit from `ReveAPIError` (in `reve.exceptions`):

- `ReveAuthenticationError` — HTTP 401
- `ReveBudgetExhaustedError` — HTTP 402
- `ReveRateLimitError` — HTTP 429 (has `.retry_after`)
- `ReveValidationError` — HTTP 400
- `ReveContentViolationError` — content policy violation

```python
from reve.exceptions import ReveAPIError, ReveRateLimitError
from reve.v1.image import create

try:
    img = create(prompt="A sunset")
except ReveRateLimitError as exc:
    print(f"Rate limited — retry after {exc.retry_after}s")
except ReveAPIError as exc:
    print(f"API error (status {exc.status_code}): {exc.message}")
```

## Advanced: Custom Client

Pass a pre-configured `ReveClient` to any function:

```python
from reve import ReveClient
from reve.v1.image import create

client = ReveClient(
    api_token="papi.xxx",
    api_url="https://custom-endpoint.example.com",
    verify=False,  # disable SSL verification for local dev
)
img = create(prompt="A sunset", client=client)
```

## SDK Source Location

The SDK source lives at `sdk/python/` in the reve-core monorepo.
Example scripts are in `sdk/python/examples/`.
