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

### Create an image from a prompt

```python
from reve.v2.image import create

result = create(prompt="A red dragon flying over mountains")
result.save("dragon.jpg")
```

Options: `references` (list of image inputs), `aspect_ratio` (`"16:9"`,
`"3:2"`, `"1:1"`, `"9:16"`, `"auto"`, and others — see the README for the full
list), `version`, `postprocessing`.

### Create with reference images

Pass reference images (each a plain image input — a file path, bytes, PIL
Image, or `ImageInput`):

```python
from reve.v2.image import create
from reve.v2.types import ImageInput

result = create(
    prompt="The subject in a magical forest",
    references=[ImageInput(data="photo.jpg")],
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
    prompt="Make the sky more dramatic with storm clouds",
    image="original.jpg",
)
result.save("edited.jpg")
```

`image` accepts an `ImageInput`, file path, raw bytes, or PIL Image.

Pass additional reference images (each a plain image input):

```python
result = edit(
    prompt="Match the lighting of the reference",
    image="original.jpg",
    references=["reference.jpg"],
)
```

### Work with layouts directly

Three layout-producing functions return a `V2LayoutResponse` (a `.layout`, no
image), letting you separate "what to draw and where" from rendering:

```python
from reve.v2.image import create_layout, image_to_layout, render

# text -> layout -> image
created = create_layout(prompt="A cozy reading nook with an armchair and a bookshelf")
image = render(layout=created.layout)
image.save("nook.jpg")

# image -> layout
analyzed = image_to_layout(image="nook.jpg")
```

- `create_layout(prompt, *, references?, aspect_ratio?, version?)` — text and/or references to layout.
- `edit_layout(prompt, *, references?, commands?, aspect_ratio?, version?)` — edit a layout with text, references, and commands.
- `render(layout, *, references?, postprocessing?, version?)` — layout to image.
- `image_to_layout(image, *, version?)` — image to layout.

`edit_layout` edits an existing layout: pass the layout you are editing as a
layout-only `Reference`. It also accepts an ordered list of `LayoutCommand`s,
appended to the prompt as natural-language directions. Each command's `op` is
one of `add`, `shift`, `remove`, `place`, `keep`, or `change`; the subject is
named by `label` or `description`; `image_index` selects an input reference
image; and `at`/`to` positions are a `Bbox(x0, y0, x1, y1)` or a `Point(x, y)`
(coordinates normalized to `[0, 1]`):

```python
from reve.v2.image import edit_layout
from reve.v2.types import Bbox, LayoutCommand, Point, Reference

edited = edit_layout(
    prompt="A desk scene",
    references=[Reference(layout=created.layout)],
    commands=[
        LayoutCommand(op="add", description="a lamp", at=Bbox(0.1, 0.1, 0.3, 0.4)),
        LayoutCommand(op="shift", label="mug", at=Point(0.5, 0.5), to=Point(0.7, 0.6)),
        LayoutCommand(op="change", label="book", new_description="an open notebook"),
    ],
)
```

A `Layout`'s optional `width`/`height` are the pixel dimensions of its
coordinate frame. The layout endpoints emit them as multiples of 32; when
supplying them on input, provide both, each a multiple of 32, with
`width * height` between `3072*2560` and `4096*4096`.

`version` is optional on every v2 call: `"latest"` (the default) aliases the
flow's current pinned version, and the version actually used is reported back as
`response.version`.

## Postprocessing

Build pipelines with helpers from `reve.v1.postprocessing`:

```python
from reve.v2.image import create
from reve.v1.postprocessing import upscale, remove_background, fit_image, effect

result = create(
    prompt="A cat astronaut",
    postprocessing=[upscale(factor=2), remove_background()],
)
```

- `upscale(factor=2)` — enlarge the image
- `remove_background()` — transparent PNG output
- `fit_image(max_width=, max_height=, max_dim=)` — constrain dimensions (px, 1–4096)
- `effect(name, parameters=None)` — apply a named effect

## Response Object

`create()`, `edit()`, and `render()` return a `V2ImageResponse` with:

- `image` — `PIL.Image.Image | None`
- `image_bytes` — `bytes` (raw image data, always present)
- `layout` — `Layout | None` (layout the model generated)
- `request_id` — `str | None`
- `credits_used` — `int | None`
- `credits_remaining` — `int | None`
- `version` — `str | None`
- `content_violation` — `bool`
- `save(path, **kwargs)` — saves via PIL if available, otherwise writes raw bytes

`image_to_layout()`, `create_layout()`, and `edit_layout()` return a
`V2LayoutResponse` with the same fields minus `image`/`image_bytes` (and no
`save`).

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
    result = create(prompt="A sunset")
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
result = create(prompt="A sunset", client=client)
```

## SDK Source Location

The SDK source lives at `sdk/python/` in the reve-core monorepo.
Example scripts are in `sdk/python/examples/`.
