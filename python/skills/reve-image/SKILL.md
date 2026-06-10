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

To check your Reve API tokens, go to `https://api.reve.com/console/keys`.
If you have none, or if you are not allowed to go to the API page, go to
`https://app.reve.com/account` and scroll to the bottom. Click "Enable API."
Once you accept the terms of service, add some API credits to your budget and
copy out the API token created for you. If you are not permitted to view API
keys on the api.reve.com/console/keys page, chances are that you are in the
wrong organization, and need to select another organization from the
user-section menu in the nav-footer bottom-left.

Optional env vars: `REVE_API_HOST` (default `https://api.reve.com`),
`REVE_PROXY_AUTHORIZATION`.

## Core Functions

All image functions live in `reve.v2.image`. Types for structured layouts live
in `reve.v2.types`.

### Create an image from an instruction

```python
from reve.v2.image import create

result = create(instruction="A red dragon flying over mountains")
result.save("dragon.jpg")
```

Options: `description` (structured layout, see below), `references` (list of
`Reference`), `aspect_ratio` (`"16:9"`, `"3:2"`, `"4:3"`, `"1:1"`, `"3:4"`,
`"2:3"`, `"9:16"`, `"auto"`), `version`, `postprocessing`.

### Create with a structured layout (Description)

The v2 API is layout-aware. Pass a `Description` to place subjects in specific
regions of the image:

```python
from reve.v2.image import create
from reve.v2.types import Bbox, Description, Region

description = Description(
    prompt="An elegant place setting on a rustic wooden table.",
    regions=[
        Region(label="plate", prompt="A white porcelain plate", bbox=Bbox(x0=0.25, y0=0.4, x1=0.75, y1=0.9)),
        Region(label="glass", prompt="A glass of amber beer", bbox=Bbox(x0=0.4, y0=0.1, x1=0.6, y1=0.3)),
    ],
)
result = create(
    instruction="An elegant restaurant table setting, top-down view",
    description=description,
    aspect_ratio="1:1",
)
result.save("table.jpg")
# result.description echoes the layout the model actually generated
```

`Bbox` values are normalized `[0, 1]` with top-left origin (`x0`, `y0`, `x1`, `y1`).

### Create with reference images

Pass `Reference` objects instead of inline `<ref>` tags:

```python
from reve.v2.image import create
from reve.v2.types import ImageInput, Reference

result = create(
    instruction="The subject in a magical forest",
    references=[
        Reference(image=ImageInput(data="photo.jpg"), prompt="Subject to place in the scene"),
    ],
    aspect_ratio="1:1",
)
```

`ImageInput.data` accepts file paths (str), raw bytes, or PIL Images.
`ImageInput.ref` accepts a project reference string (`"id:<uuid>"` or
`"reference:@<name>"`).

### Edit an existing image

```python
from reve.v2.image import edit

result = edit(
    instruction="Make the sky more dramatic with storm clouds",
    image="original.jpg",
)
result.save("edited.jpg")
```

`image` accepts an `ImageInput`, file path, raw bytes, or PIL Image.

Edit with layout guidance using `old_description` and `new_description`:

```python
result = edit(
    instruction="Move the plate to the left side",
    image="original.jpg",
    old_description=old_layout,
    new_description=new_layout,
)
```

## Postprocessing

Build pipelines with helpers from `reve.v1.postprocessing`:

```python
from reve.v2.image import create
from reve.v1.postprocessing import upscale, remove_background, fit_image, effect

result = create(
    instruction="A cat astronaut",
    postprocessing=[upscale(factor=2), remove_background()],
)
```

- `upscale(factor=2)` — enlarge the image
- `remove_background()` — transparent PNG output
- `fit_image(max_width=, max_height=, max_dim=)` — constrain dimensions (px, 1–4096)
- `effect(name, parameters=None)` — apply a named effect

## Response Object

`create()` and `edit()` return a `V2ImageResponse` with:

- `image` — `PIL.Image.Image | None`
- `image_bytes` — `bytes` (raw image data, always present)
- `description` — `Description | None` (layout the model generated)
- `request_id` — `str | None`
- `credits_used` — `int | None`
- `credits_remaining` — `int | None`
- `version` — `str | None`
- `content_violation` — `bool`
- `save(path, **kwargs)` — saves via PIL if available, otherwise writes raw bytes

## Error Handling

All exceptions inherit from `ReveAPIError` (in `reve.exceptions`):

- `ReveAuthenticationError` — HTTP 401
- `ReveBudgetExhaustedError` — HTTP 402
- `ReveRateLimitError` — HTTP 429 (has `.retry_after`)
- `ReveValidationError` — HTTP 400
- `ReveContentViolationError` — content policy violation

```python
from reve.exceptions import ReveAPIError, ReveRateLimitError
from reve.v2.image import create

try:
    result = create(instruction="A sunset")
except ReveRateLimitError as exc:
    print(f"Rate limited — retry after {exc.retry_after}s")
except ReveAPIError as exc:
    print(f"API error (status {exc.status_code}): {exc.message}")
```

## Advanced: Custom Client

Pass a pre-configured `ReveClient` to any function:

```python
from reve import ReveClient
from reve.v2.image import create

client = ReveClient(
    api_token="papi.xxx",
    api_url="https://custom-endpoint.example.com",
    verify=False,  # disable SSL verification for local dev
)
result = create(instruction="A sunset", client=client)
```

## SDK Source Location

The SDK source lives at `sdk/python/` in the reve-core monorepo.
Example scripts are in `sdk/python/examples/`.
