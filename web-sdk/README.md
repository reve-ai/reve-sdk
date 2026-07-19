# Reve Web SDK

A stand-alone, zero-dependency browser SDK for the
[Reve partner API v2](https://api.reve.com/):

- `<reve-layout-overlay>` — a lightweight web component (no shadow DOM, no
  framework) that renders an image with the regions of a v2 layout overlaid
  as colored, interactive frames.
- `ReveClient` — a small `fetch()` wrapper that carries your API token and
  covers the `/v2/image` endpoints plus the postprocessor and effect
  discovery endpoints.

## Installation

```sh
npm install @reve-ai/web-sdk
```

Or load it directly from a CDN in a plain HTML page:

```html
<script type="module">
  import "https://unpkg.com/@reve-ai/web-sdk/dist/index.js";
</script>
```

The package ships as a single self-contained ESM bundle (`dist/index.js`)
plus type declarations; there are no runtime dependencies.

## The `<reve-layout-overlay>` component

Importing the package registers the custom element. Give it an image and a
layout:

```html
<reve-layout-overlay
  src="photo.png"
  default-color="#ffffff"
  selected-color="#ff4000"
  idle-opacity="0.25"
  show-labels="true"
></reve-layout-overlay>

<script type="module">
  import "@reve-ai/web-sdk";

  const overlay = document.querySelector("reve-layout-overlay");
  overlay.layout = layoutFromTheApi; // a V2Layout object
  overlay.colorMap = {
    // region label -> CSS color for that region's frame
    dog: "#22cc44",
    "picnic table": "rgb(200, 120, 0)",
  };
</script>
```

Regions whose label has no entry in `colorMap` use `default-color`.

### Attributes

| Attribute        | Default   | Meaning                                                          |
| ---------------- | --------- | ---------------------------------------------------------------- |
| `src`            | —         | URL of the image rendered under the overlay.                     |
| `layout`         | —         | The layout as a JSON string (or set the `layout` property).      |
| `color-map`      | —         | Label→color map as JSON (or set the `colorMap` property).        |
| `default-color`  | `#ffffff` | Frame color when a label is not in the color map.                |
| `selected-color` | `#ff4000` | Frame color while a region is selected.                          |
| `idle-opacity`   | `0.25`    | Frame opacity when neither hovered nor selected; `0` = hidden.   |
| `show-labels`    | `true`    | Show or hide the text label at the top-left of each region.      |
| `selection-mode` | `single`  | Controls click-based selection: `single`, `multiple`, or `none`. |

Frames are drawn at `idle-opacity` when idle, become fully opaque while the
pointer hovers over them, and switch to `selected-color` when selected.
Each region also displays a small text label (class `reve-region-label`) at
its top-left corner; set `showLabels = false` or `show-labels="false"` to
hide all labels without triggering a full re-render.

`selection-mode` controls what happens when a region is clicked:

| Mode         | Behavior                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `"single"`   | Clears any existing selection, then selects the clicked region. Clicking it again deselects it. |
| `"multiple"` | Each click independently toggles the region's selection state.                                  |
| `"none"`     | Clicks do not change selection. The programmatic API (`select`, `unselect`, etc.) still works.  |

The following methods and properties control selection programmatically:

| Member                         | Description                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- |
| `select(label)`                | Select a region; emits `reve-region-selected`.                              |
| `unselect(label)`              | Unselect a region; emits `reve-region-unselected`.                          |
| `setSelected(label, selected)` | Select or unselect by boolean; no-op for unknown labels.                    |
| `clearSelection()`             | Unselect every selected region, emitting `reve-region-unselected` for each. |
| `getSelectedLabels()`          | Returns a `string[]` of the currently selected labels.                      |
| `selectedLabels`               | `ReadonlySet<string>` of the currently selected labels.                     |
| `getRegionLabels()`            | Returns a `string[]` of all region labels in the layout, in order.          |

### Events

Each event is a bubbling `CustomEvent` whose `detail` is
`{ region, index, label }` (the `V2Region`, its index in `layout.regions`,
and its label):

- `reve-region-hover-enter`
- `reve-region-hover-leave`
- `reve-region-clicked` — fired on every click regardless of `selectionMode`
- `reve-region-selected`
- `reve-region-unselected`

```js
overlay.addEventListener("reve-region-selected", (event) => {
  console.log("selected", event.detail.label, event.detail.region.bbox);
});
```

## Calling the API

> **Token safety:** a browser page exposes anything it holds, including your
> `papi.…` token. Only call the API directly from pages you trust (internal
> tools, local development); for public sites, proxy requests through your
> own backend and keep the token there.

```js
import { ReveClient, imageResponseToObjectUrl } from "@reve-ai/web-sdk";

// Also accepts an `apiUrl` (defaults to https://api.reve.com) and a
// custom `fetch` implementation.
const client = new ReveClient({ apiToken: "papi.…" });

// Generate an image; the response includes the layout the model produced.
const created = await client.createImage({
  prompt: "A dog next to a picnic table, golden hour",
  aspect_ratio: "16:9",
});

const overlay = document.querySelector("reve-layout-overlay");
overlay.src = imageResponseToObjectUrl(created);
overlay.layout = created.layout;
```

The four endpoint wrappers all take the exported request body types
(`V2ImageCreateRequest`, `V2ExtractLayoutRequest`, …) and return a
`V2ImageResponse`:

| Method                          | Endpoint                   | Produces       |
| ------------------------------- | -------------------------- | -------------- |
| `client.createImage(request)`   | `/v2/image/create`         | image + layout |
| `client.extractLayout(request)` | `/v2/image/extract_layout` | layout only    |
| `client.createLayout(request)`  | `/v2/image/create_layout`  | layout only    |
| `client.renderLayout(request)`  | `/v2/image/render_layout`  | image + layout |

### Postprocessors and effects

Three discovery helpers list what postprocessing is available:

- `client.listPostprocessors()` — the available postprocessing operations
  and their credit costs (`V2PostprocessCost[]`, from `GET /v2/image/info`).
- `client.getImageInfo()` — the full `/v2/image/info` response, including
  per-operation credit costs alongside the postprocessors.
- `client.listEffects(source?)` — the effects usable with the `"effect"`
  postprocessor (`V1EffectInfo[]`, from `GET /v1/image/effect`). Pass
  `"project"` for effects saved in your project, `"preset"` for built-in
  presets, or `"all"` (default) for both.

```js
const postprocessors = await client.listPostprocessors();
// [{ process: "upscale", credits_base: …, credits_per_megapixel: … }, …]

const effects = await client.listEffects("preset");
// [{ name: "…", description: "…", source: "preset", category: "…" }, …]
```

For example, to extract a layout from a user-supplied image and overlay it:

```js
const base64 = btoa(String.fromCharCode(...new Uint8Array(await file.arrayBuffer())));
const extracted = await client.extractLayout({ image: { data: base64 } });
overlay.src = URL.createObjectURL(file);
overlay.layout = extracted.layout;
```

Non-2xx responses throw `ReveApiError` with `status`, `requestId`, and the
parsed error `payload`.

### Response helpers and types

The base-64 `image` field of a `V2ImageResponse` can be decoded with:

- `imageResponseToBlob(response, mimeType?)` — returns a `Blob`
  (default type `image/png`), or `null` if the response has no image.
- `imageResponseToObjectUrl(response, mimeType?)` — returns an object URL
  for an `<img src>`, or `null`. Release it with `URL.revokeObjectURL`
  when done.

All request and response types (`V2Layout`, `V2Region`,
`V2ImageCreateRequest`, `V2ImageResponse`, …) are exported from the package
for TypeScript users.

## Example

[`example/index.html`](example/index.html) is a minimal page with a token
field, a prompt, and a Render button that displays the generated image and
its layout using the component. It imports `../dist/index.js` directly, so
after building you can serve the package directory with any static file
server and open `/example/index.html` (ES modules do not load over
`file://`).

## Building

Inside the reve-core monorepo (dependencies are installed via `rush update`):

```sh
rushx build
```

The build bundles the SDK with vite into a single ESM file (`dist/index.js`),
emits type declarations with `tsc`, and then runs
`scripts/verify-standalone.mjs`, which fails the build if the package
declares any runtime dependency or if any file in `dist/` imports a bare
(non-relative) module specifier. The published package is guaranteed to be
fully self-contained; the partner API interface declarations are inlined
copies in `src/types.ts`.

`rushx test` runs the unit tests (vitest + happy-dom) covering the client's
request/error behavior and the component's rendering, hover, and selection
behavior.
