# Reve Python SDK

A Pythonic interface to the [Reve](https://reve.art) image-generation API.
Generate, remix, and edit images with a handful of function calls.

## Installation

From PyPI:

```bash
pip install reve
```

From source:

```bash
git clone https://github.com/reve-ai/reve-core.git
cd reve-core/sdk/python
pip install -e .
```

## Quick Start

```python
from reve.v1.image import create

img = create(prompt="A beautiful sunset over the ocean")
img.save("sunset.jpg")
print(img.credits_remaining)
```

> Set the `REVE_API_TOKEN` environment variable before running,
> or pass `api_token=` directly to any function.

## Authentication

The SDK reads credentials from environment variables by default:

| Variable                   | Description                | Default                |
| -------------------------- | -------------------------- | ---------------------- |
| `REVE_API_TOKEN`           | Bearer token (required)    | —                      |
| `REVE_API_HOST`            | API base URL               | `https://api.reve.com` |
| `REVE_PROXY_AUTHORIZATION` | Proxy-authorization header | —                      |

```bash
export REVE_API_TOKEN="papi.your-token-here"
```

You can also pass them per-call:

```python
img = create(
    prompt="A sunset",
    api_token="papi.your-token-here",
    api_url="https://custom-endpoint.example.com",
)
```

## API Reference

All image functions live in `reve.v1.image`.

### `create(prompt, *, aspect_ratio, version, test_time_scaling, postprocessing, ...)`

Generate an image from a text prompt.

```python
from reve.v1.image import create
from reve.v1.postprocessing import upscale, remove_background

img = create(
    prompt="A red dragon flying over mountains",
    aspect_ratio="16:9",
    version="latest",
    test_time_scaling=3,
    postprocessing=[upscale(factor=2), remove_background()],
)
img.save("dragon.png")
```

| Parameter           | Type                 | Description                                                                                         |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `prompt`            | `str`                | Text description of the image (positional).                                                         |
| `aspect_ratio`      | `str \| None`        | One of `"16:9"`, `"3:2"`, `"4:3"`, `"1:1"`, `"3:4"`, `"2:3"`, `"9:16"`, `"auto"`. Default `"auto"`. |
| `version`           | `str \| None`        | Model version identifier or `"latest"`.                                                             |
| `test_time_scaling` | `int \| None`        | Quality factor 1–5. Higher = better quality, more credits.                                          |
| `postprocessing`    | `list[dict] \| None` | Postprocessing pipeline (see below).                                                                |

### `remix(prompt, reference_images, *, ...)`

Remix reference images into a new image guided by a prompt.
Use `<ref>0</ref>`, `<ref>1</ref>`, … to refer to each reference image.

```python
from reve.v1.image import remix

img = remix(
    prompt="The subject from <ref>0</ref> standing in a magical forest",
    reference_images=["photo.jpg"],
    aspect_ratio="1:1",
)
```

| Parameter           | Type                                  | Description                                                           |
| ------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `prompt`            | `str`                                 | Text prompt with optional `<ref>N</ref>` tags (positional).           |
| `reference_images`  | `Sequence[str \| bytes \| PIL.Image]` | Reference images — file paths, raw bytes, or PIL Images (positional). |
| `aspect_ratio`      | `str \| None`                         | Aspect ratio (see `create`).                                          |
| `version`           | `str \| None`                         | Model version.                                                        |
| `test_time_scaling` | `int \| None`                         | Quality factor 1–5.                                                   |
| `postprocessing`    | `list[dict] \| None`                  | Postprocessing pipeline.                                              |

### `edit(edit_instruction, reference_image, *, ...)`

Edit an existing image with a natural-language instruction.

```python
from reve.v1.image import edit

img = edit(
    edit_instruction="Make the sky more dramatic with storm clouds",
    reference_image="original.jpg",
)
```

| Parameter           | Type                        | Description                           |
| ------------------- | --------------------------- | ------------------------------------- |
| `edit_instruction`  | `str`                       | Description of the edit (positional). |
| `reference_image`   | `str \| bytes \| PIL.Image` | Source image (positional).            |
| `aspect_ratio`      | `str \| None`               | Aspect ratio (see `create`).          |
| `version`           | `str \| None`               | Model version.                        |
| `test_time_scaling` | `int \| None`               | Quality factor 1–5.                   |
| `postprocessing`    | `list[dict] \| None`        | Postprocessing pipeline.              |

### `get_balance(*, ...)`

Return the current credit balance.

```python
from reve.v1.image import get_balance

balance = get_balance()
print(balance)  # {"budget_id": "abc123", "new_balance": 500}
```

Returns a `dict` with keys `budget_id` (str) and `new_balance` (number).

### `list_effects(source=None, *, ...)`

List available effects for postprocessing.

```python
from reve.v1.image import list_effects

effects = list_effects(source="preset")
for e in effects:
    print(e["name"], "-", e["description"])
```

| Parameter | Type          | Description                                            |
| --------- | ------------- | ------------------------------------------------------ |
| `source`  | `str \| None` | Filter by source: `"all"`, `"project"`, or `"preset"`. |

Returns a list of dicts with `name`, `description`, `source`, and `category` keys.

## v2 Layout-Aware API

The `reve.v2.image` module exposes four operations: `create`, `extract_layout`,
`create_layout`, and `render_layout`. Layout operations use a structured
`Layout` (a list of labelled, bounded `Region`s), and image-producing calls
return the layout used for the result.

Functions live in `reve.v2.image`; the data structures live in `reve.v2.types`
(and are also re-exported from `reve.v2`).

```python
from reve.v2.image import create
from reve.v2.types import ImageInput

result = create(
    prompt="A dog on the left and a cat on the right",
    references=[ImageInput(ref="reference:@mypet")],  # optional, each an image
    aspect_ratio="16:9",
)
result.save("pets.png")
print(result.layout)  # the layout the model generated
```

To edit an existing image, pass it first in the ordered `references` list:

```python
from reve.v2.image import create

result = create(
    prompt="Make the sky stormy",
    references=["original.jpg", "lighting-reference.jpg"],
)
```

### Functions (`reve.v2.image`)

There are two families. **Image-producing** functions return a
`V2ImageResponse`; **layout-producing** functions return a `V2LayoutResponse`
and produce no image.

| Function                                                                     | Kind   | Description                                    |
| ---------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| `create(prompt, *, references?, aspect_ratio?, postprocessing?, version?)`   | image  | Generate or edit an image.                     |
| `extract_layout(image, *, prompt?, version?)`                                | layout | Extract a layout, optionally applying an edit. |
| `create_layout(prompt?, *, references?, commands?, aspect_ratio?, version?)` | layout | Generate or edit a layout.                     |
| `render_layout(layout, *, references?, postprocessing?, version?)`           | image  | Render an image from a target layout.          |

`aspect_ratio` is one of `4:1`, `3:1`, `21:9`, `2:1`, `17:9`, `16:9`, `3:2`,
`4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, `1:2`, `1:3`, `1:4`, or
`auto` (default).

`create` accepts only ordered image references. `create_layout` and
`render_layout` accept ordered `Reference` values containing an image, a
layout, an optional descriptive prompt, or a supported combination. Commands
on `create_layout` require at least one reference.

### Input types (`reve.v2.types`)

| Type         | Fields                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| `ImageInput` | `data` (path/bytes/PIL, base-64 in JSON) **or** `ref` (`id:<uuid>` / `reference:@<name>`).   |
| `Bbox`       | `x0`, `y0`, `x1`, `y1` — normalized to `[0, 1]`, top-left origin.                            |
| `Region`     | `label`, `prompt`, `bbox`, `image_index?`, `image_region_index?`, `parent?`, `region_type?`. |
| `Layout`     | `regions: list[Region]`, `prompt?`, `normalized_edit_instruction?`, `width?`, `height?`.     |
| `Reference`  | `image: ImageInput?`, `prompt?`, `layout?` — an image and/or a layout.                       |

`width`/`height` are the pixel dimensions of the layout's coordinate frame.
The layout endpoints emit them as multiples of 32; when you supply them on
input, provide both, each a multiple of 32, with `width * height` between
`3072*2560` and `4096*4096`.

`region_type` is a level-of-detail / special-handling hint, one of:
`coarse_detail` (a high-level object such as a person or car), `medium_detail`
(a medium-level object such as an arm or belt, whose parent is a
`coarse_detail`), `fine_detail` (a fine detail such as a ring or buckle, whose
parent is a `medium_detail`), `text` (embedded text), `hand`, or `face`.

The `ref` form of `ImageInput` points at an image that already exists in the
project your API key belongs to:

- `id:<uuid>` — the ID of an image or generation in the project (for example,
  one created in the Reve app). A generation ID resolves to that generation's
  output image.
- `reference:@<name>` — the name of a reference entity defined in the project
  in the Reve app.

### Response types

`create` and `render_layout` return a `V2ImageResponse`:

| Field               | Type                      | Description                              |
| ------------------- | ------------------------- | ---------------------------------------- |
| `image`             | `PIL.Image.Image \| None` | The generated image.                     |
| `image_bytes`       | `bytes`                   | Raw bytes of the generated image.        |
| `layout`            | `Layout \| None`          | The layout the model generated.          |
| `request_id`        | `str \| None`             | Unique request identifier.               |
| `credits_used`      | `int \| None`             | Credits consumed by this request.        |
| `credits_remaining` | `int \| None`             | Credits remaining in the budget.         |
| `version`           | `str \| None`             | Model version used.                      |
| `content_violation` | `bool`                    | Whether a content violation was flagged. |

`extract_layout` and `create_layout` return a
`V2LayoutResponse` with the same fields minus `image` and `image_bytes`.

## Postprocessing

Build postprocessing pipelines with helpers from `reve.v1.postprocessing`:

```python
from reve.v1.postprocessing import upscale, remove_background, fit_image, effect
```

| Helper                                                     | Description                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `upscale(factor=2)`                                        | Upscale the image by the given factor.                          |
| `remove_background()`                                      | Remove the background (produces transparent PNG).               |
| `fit_image(max_width=None, max_height=None, max_dim=None)` | Constrain dimensions (pixels, 1–1024).                          |
| `effect(name, parameters=None)`                            | Apply a named effect. Use `list_effects()` for available names. |

Pass them as a list to the `postprocessing` parameter:

```python
img = create(
    prompt="A cat astronaut",
    postprocessing=[upscale(factor=2), remove_background()],
)
```

## Response Object

`create()`, `remix()`, and `edit()` return an `ImageResponse` (a Pydantic BaseModel):

| Field               | Type              | Description                              |
| ------------------- | ----------------- | ---------------------------------------- |
| `image`             | `PIL.Image.Image` | The generated image.                     |
| `request_id`        | `str \| None`     | Unique request identifier.               |
| `credits_used`      | `int \| None`     | Credits consumed by this request.        |
| `credits_remaining` | `int \| None`     | Credits remaining in the budget.         |
| `version`           | `str \| None`     | Model version used.                      |
| `content_violation` | `bool`            | Whether a content violation was flagged. |

```python
img = create(prompt="A sunset")
img.image              # PIL.Image.Image
img.request_id         # "req_abc123"
img.credits_used       # 10
img.credits_remaining  # 490
img.version            # "v1.2"
img.save("out.jpg")    # delegates to PIL.Image.save()
```

## Error Handling

All exceptions inherit from `ReveAPIError`:

```
ReveAPIError                  # Base — any API error
├── ReveAuthenticationError   # HTTP 401 — bad or missing token
├── ReveBudgetExhaustedError  # HTTP 402 — out of credits
├── ReveRateLimitError        # HTTP 429 — rate limited (has .retry_after)
├── ReveValidationError       # HTTP 400 — invalid parameters
└── ReveContentViolationError # Content policy violation
```

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

## Examples

Working example scripts are in the [`examples/`](examples/) directory:

- [`create_image.py`](examples/create_image.py) — Generate images with optional postprocessing.
- [`remix_image.py`](examples/remix_image.py) — Remix a reference image with a prompt.
- [`edit_image.py`](examples/edit_image.py) — Edit an existing image.
- [`v2_create_image.py`](examples/v2_create_image.py) — Generate a layout-aware image with the v2 API.
- [`v2_create_with_references.py`](examples/v2_create_with_references.py) — Generate or edit from ordered image references.
- [`v2_layout_pipeline.py`](examples/v2_layout_pipeline.py) — Drive `create_layout`, `render_layout`, and `extract_layout` end to end.

## Development

Install development dependencies:

```bash
pip install -e ".[dev]"
```

Run the test suite:

```bash
pytest
```

## License

This SDK is released under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).
