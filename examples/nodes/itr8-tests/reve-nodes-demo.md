# Reve Nodes — E2E test matrix

Status legend: **Pass** (executed and confirmed this session) · **Not run**
(deliberately skipped — would spend real Reve credits, or requires
infrastructure unavailable this session) · **Pending** (needs a live
interactive/visual pass).

Verification commands used for the "Pass" rows below: `npm install`,
`npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, and a
background `npm run dev -- -p 3417` probed with `curl`. See the session
transcript for exact commands/output.

## Build & tooling

| ID | Test case | Expected result | Status |
| --- | --- | --- | --- |
| B1 | `npm install` | Installs cleanly (no fatal errors) | Pass |
| B2 | `npx tsc --noEmit` | Zero type errors | Pass |
| B3 | `npm run lint` | Zero ESLint warnings/errors | Pass |
| B4 | `npx vitest run` | All unit tests pass (90/90 currently across 13 files) | Pass |
| B5 | `npm run build` | Production build succeeds; all 12 app routes compile (including both download handoffs and both ephemeral-payload API routes) | Pass |
| B6 | `npm run dev` boots and serves `/` | HTTP 200 on the dev server's root | Pass |

## Blob store & upload pipeline (`/api/blobs*`)

| ID | Test case | Expected result | Status |
| --- | --- | --- | --- |
| U1 | Upload a real 1×1 PNG via `{data: base64}` JSON | 200, returns `{id, mediaType: "image/png", size}` | Pass |
| U2 | `GET /api/blobs/[id]` for that id (no `?w=`) | 200, `Content-Type: image/png`, original bytes returned (verified as valid PNG via `file`) | Pass |
| U2b | `GET /api/blobs/[id]?download=1` | 200 with `Content-Disposition: attachment`, safe filename, exact byte length, `nosniff`; bytes match stored original | Pass — headers checked with `curl`; byte equality checked with `cmp` |
| U3 | `GET /api/blobs/[id]?w=64` | 200, `Content-Type: image/jpeg`, resized via `sharp` (verified as valid JPEG via `file`) | Pass |
| U4 | `GET /api/blobs/<unknown-uuid>` | 404 | Pass |
| U5 | Upload a text file with a spoofed `image/png` Content-Type (multipart) | Rejected with `BLOB_ERROR` — magic-number sniff catches it, not the declared type | Pass |
| U6 | Multipart upload with no `file` field | 400, clear error message | Pass |
| U7 | Upload a file >40MB | Rejected with a size-limit message | Not run — didn't generate a 40MB fixture this session; logic reviewed in `blobStore.ts` (`MAX_BLOB_BYTES` check runs before any disk write) |
| U8 | Drop an image onto an existing Image node | Uploads via the same `/api/blobs` path, replaces the image, and does not also spawn a canvas-level duplicate | Pass — real Chrome `DataTransfer` drop replaced the blob id while node count stayed exactly 9 |

## Request validation (`/api/reve/*`, before any Reve call)

| ID | Test case | Expected result | Status |
| --- | --- | --- | --- |
| V1 | `POST /api/reve/create` with no `prompt` | 400, `INVALID_REQUEST`, names the missing field | Pass |
| V2 | `POST /api/reve/extract-layout` with no `image` | 400, `INVALID_REQUEST` | Pass |
| V3 | `POST /api/reve/create-layout` with empty body | 400, "at least one of prompt or references is required" | Pass |
| V4 | `POST /api/reve/create-layout` with `commands` but no `references` | 400, "commands require at least one reference" | Pass |
| V5 | `POST /api/reve/render-layout` with no `layout` | 400, `INVALID_REQUEST` | Pass |
| V6 | `POST /api/reve/render-layout` with a region missing `bbox` | 400, path points at `layout.regions.0.bbox` | Pass |
| V7 | Any Reve route with no `REVE_API_KEY` configured | 500, `MISSING_API_KEY`, actionable message — fails *before* any network call, so no credits are at risk | Pass |

## Real Reve API calls (require a configured key — spend credits)

| ID | Test case | Expected result | Status |
| --- | --- | --- | --- |
| R1 | V2 Create with a valid prompt | Returns image + layout; node shows the image and credit metadata | Not run — no `REVE_API_KEY` configured this session, and the task explicitly says not to spend credits without one already safely configured |
| R2 | Extract Layout on an uploaded image | Returns a layout with ≥1 region | Not run (same reason) |
| R3 | Create Layout with prompt + 2 reference images, ordered by Y position | Returns a layout; reference order matches node stacking | Not run (same reason) |
| R4 | Render Layout on an edited layout | Returns a re-rendered image reflecting the edit | Not run (same reason) |
| R5 | A prompt that trips Reve's content policy | 200 response, `content_violation: true`, no image; UI shows the amber warning state, not a red error | Not run (same reason) |
| R6 | A genuinely malformed upstream request (e.g. bad `version` string) | Reve's 4xx forwarded faithfully with its `error_code`/`message`/`params` | Not run (same reason) |

## Interactive canvas / UI

Headless Chrome/CDP smoke against the running dev server visually confirmed
the starter canvas, exercised a real palette click, and now covers native
image/layout `DataTransfer` drops, exact placement, node-local replacement,
invalid-layout safety, direct layout saving, and the actual sandboxed iframe
handoff branch. Keyboard, OS file-picker selection, and API-backed interactions
that remain **Pending** are listed below.

| ID | Test case | Expected result | Status | Related unit coverage |
| --- | --- | --- | --- | --- |
| I1 | Canvas loads with the seeded starter workflow | 7 nodes, 8 edges visible, `fitView` frames the complete create → edit-layout → create-layout → edit-layout → render pipeline without covering the palette | Pass — fresh-origin Chrome at 1440×1000 rendered the exact seven stable node ids and eight edges; palette overlap was false; viewport fitted to `translate(109.934px, 343.046px) scale(0.467125)` | `seedWorkflow.test.ts` covers exact nodes, edges, portability, and fresh-object resets |
| I2 | Clicking a palette entry | New node appears with default data in a collision-free grid slot; view refits | Pass — real hydrated DOM click; no node/palette overlap | `nodePlacement.test.ts`, `nodeRegistry.ts` |
| I2b | Dragging a palette entry onto the canvas | New node appears at the exact drop position with default data | Pending | `nodeRegistry.ts` (`defaultDataFor`) has no dedicated test — trivial object spread |
| I2c | Drop a valid image file onto empty canvas | Creates a populated Image node at the exact pointer position; image bytes go through `/api/blobs`, never graph state | Pass — real Chrome drop created `image-f5c209ee` at exactly (460,420), uploaded/previewed a blob, and increased node count 7→8 | `fileImports.test.ts` covers classification; server magic-byte validation is covered by U5 |
| I2d | Drop valid layout JSON onto empty canvas | Creates a populated Layout Editor at the exact pointer position with schema-validated output | Pass — real Chrome drop created `layoutEditor-2fd2b94f` at exactly (760,560), showed `regions: 1`, and increased node count 8→9 | `fileImports.test.ts` covers type/size/schema success and failure |
| I2e | Drop an unsupported file onto empty canvas | No node is created; transient accessible error names the unsupported file | Pending | `fileImports.test.ts` covers unsupported classification |
| I3 | Connecting an `image`-kind output to a `layout`-kind input | Rejected (handle shows invalid state, no edge created) | Pending | `connectionRules.test.ts` — kind-mismatch case |
| I4 | Connecting a second edge into a singular (`image`/`layout`) target handle | Rejected | Pending | `connectionRules.test.ts` — occupied-handle case |
| I5 | Connecting two edges that would form a cycle | Rejected | Pending | `connectionRules.test.ts`, `graphOrder.test.ts` — cycle cases |
| I6 | Connecting a node's output back into its own input | Rejected (self-loop) | Pending | `connectionRules.test.ts` — self-loop case |
| I7 | Per-node Run button while its required input is unconnected | Button disabled or run short-circuits with a clear error, no network call | Pending | Reviewed in each node's `run()`; e.g. Extract Layout checks `imageId` before calling `runExtractLayout` |
| I8 | "▶ Run all" on a graph with independent branches | Independent branches run concurrently (same wave); dependent nodes wait | Pending | `graphOrder.test.ts` — diamond-graph wave grouping |
| I9 | "▶ Run all" on a graph containing a cycle | Cyclic nodes are skipped with a toolbar warning; the rest of the graph still runs | Pending | `graphOrder.test.ts` — cycle exclusion case |
| I10 | Layout Editor auto-syncs from upstream, then freezes once you type | Textarea updates live until first keystroke; "Pull upstream" resyncs | Pending | Debounce/parse logic mirrors `layoutEditing.test.ts`'s `parseLayoutJson`/`stringifyLayout` coverage |
| I10b | Drop/upload valid and invalid JSON onto an existing Layout Editor | Valid JSON replaces draft/output; invalid JSON stays editable, preserves last good output, disables download, and does not spawn a duplicate node | Pass — real Chrome valid→invalid→valid drop sequence kept node count 9, surfaced `Invalid layout:`, and disabled/re-enabled Download correctly | `fileImports.test.ts` covers 1MB pre-read cap, canonical success, malformed JSON, schema rejection, and editable draft retention |
| I10c | Download a valid Layout Editor layout | Top-level path writes formatted JSON through the native-picker code path; embedded iframe click publishes a short-lived server payload and opens the populated `/download/layout/[key]` handoff across Chrome's storage-partition boundary; unavailable picker exposes copy fallback | Pass — direct picker stub captured exact `application/json;charset=utf-8` content/filename. A genuine cross-site sandbox harness (`127.0.0.1:8099` top-level → `localhost:3417` OOPIF) first reproduced the localStorage-partition failure, then passed after the server transport fix: popup had the exact `crosssite` payload, no error, and the iframe remained at 7 nodes. Native OS dialog intentionally not clicked by automation | `layoutDownload.test.ts` covers UUID/payload validation, filename sanitization, 1MB cap, five-minute expiry, explicit deletion, and 32-entry eviction |
| I11 | Image Editor: draw a region by dragging on the image | New region appears with a default label, selected | Pending | `layoutEditing.test.ts` — `addRegion` |
| I12 | Image Editor: drag a corner handle to resize a region | bbox updates, clamped to [0,1] | Pending | `layoutEditing.test.ts` — `resizeRegion`/`clampBBox` |
| I13 | Image Editor: drag inside a region to move it | bbox translates, clamped so it can't leave [0,1] | Pending | `layoutEditing.test.ts` — `moveRegion` clamp case |
| I14 | Image Editor: delete a region that's a `parent` of another | Child region's `parent` field is cleared, not left dangling | Pending | `layoutEditing.test.ts` — `removeRegion` dangling-parent case |
| I15 | Image node: download / open buttons | Top-level Download saves directly without a new tab; a sandboxed preview opens a handoff page whose user-initiated **Choose save location** flow writes the fetched image through Chrome's File System Access API; Open shows the original inline | Pass — top-level native download is byte-for-byte verified. Real itr8 testing disproved the attachment-link handoff because its popup inherits the iframe's download prohibition; the File System Access replacement then opened Chrome's native Save dialog and the host confirmed the image saved perfectly | `blobSrc.test.ts` covers original/thumbnail/attachment/handoff URLs; no-escape CDP probe reached the exact picker path without `SecurityError`/`TypeError` |
| I15b | Image node: select and drag a resize handle, then reload | Node and preview grow together; image preserves aspect ratio; larger preview requests a higher-resolution thumbnail; width/height persist across reload | Pass — real CDP pointer drag grew the node to 1001×821 and preview to 973×620, selected `w=1600`, and restored the exact node-local dimensions after reload | — |
| I15c | Image Editor node: resize larger and down to its minimum, then reload | Node and editing workspace grow together; image and editable region overlay remain aspect-fit/aligned; larger workspace requests a higher-resolution thumbnail; width/height persist; minimum-size controls remain contained and internally scrollable | Pass — real CDP pointer drag grew the node from 361×622 to 1207×1071 and workspace from 337×240 to 1183×689, selected `w=1600`, kept the 2:1 image aspect exactly, aligned the test region within 0.001px, and restored exact dimensions after reload. A targeted 344×480 selected-region check confirmed 626px of content is contained by the internal scroller rather than spilling onto the canvas | — |
| I16 | Reload the page after building a non-trivial graph | Graph (nodes/edges, prompts, layouts) restored from `localStorage`; no image bytes were ever in it | Pending | `persistence.ts` logic is a thin localStorage wrapper; the *invariant* it depends on (node data only ever holds `{id, mediaType}`) is enforced by each node's own state shape, reviewed by hand |
| I17 | "Reset workflow" | Confirmation prompt, then clears storage and reloads the seed graph | Pending | — |
| I18 | ⌘/Ctrl+D duplicates selected node(s) | Clone(s) appear offset by (40, 40), fresh id, no stale run status/output carried over | Pending | Reviewed by hand in `Canvas.tsx`'s `duplicateSelected` |
| I19 | Backspace/Delete removes selected node(s)/edge(s) | Removed from canvas and (after debounce) from `localStorage` | Pending | React Flow's built-in `deleteKeyCode` behavior — not custom code |
| I20 | itr8 bridge reports selection changes | `window.itr8.updateModelContext` called with node type/id on selection change | Pending | Reviewed by hand in `Canvas.tsx`'s `onSelectionChange`; see `itr8.md` |

## Known gaps / explicitly out of scope

- No committed browser-test suite (Playwright/Cypress). A one-off headless
  Chrome/CDP smoke verified initial rendering and palette-click placement;
  the remaining Interactive canvas rows are the manual test plan for the
  next active desktop session.
- No postprocessing (upscale/remove-background/effects) UI, per README
  "Deployment caveats".
- No automated test for the 40MB image upload-size rejection (U7) — logic-reviewed
  only, to avoid generating and uploading a real 40MB fixture in this
  session. The separate 1MB layout-file and embedded-handoff limits are fully
  unit-tested without allocating a large fixture.
