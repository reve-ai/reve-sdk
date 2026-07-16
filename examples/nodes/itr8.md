# itr8 review notes

Created with itr8.ai.

This app is instrumented with the itr8 prototype bridge so it can be reviewed
as a local dev-server web preview inside itr8, with itr8 agents/host seeing
live semantic context instead of just a screenshot.

## What's installed

- **Bridge loader** — `src/app/layout.tsx` injects the itr8 web-preview
  bridge loader script into `<head>`. It resolves the bridge origin from
  `document.referrer` (falling back to `https://itr8.ai`), so it works in
  both local dev and any later deployment without hard-coding a host/port.
- **Model context reporting** — `src/components/Canvas.tsx`'s
  `onSelectionChange` handler calls `window.itr8?.updateModelContext(...)`
  with the current screen name, the selected node's type/id, selection
  count, and total node/edge counts, whenever the React Flow selection
  changes.
- **Stable `data-itr8-id` attributes**:
  - `app-root` — the page's `<main>`.
  - `canvas` — the React Flow container.
  - `toolbar`, `toolbar-run-all`, `toolbar-reset` — the top-left toolbar and
    its two buttons.
  - `palette`, `palette-item-<nodeType>` — the node palette and each entry
    (e.g. `palette-item-v2Create`).
  - `node-<title-kebab-case>` — every node's outer card, set generically by
    `NodeShell` (e.g. `node-v2-create`, `node-image-editor`). This is a
    _type-level_ id (shared across multiple instances of the same node
    type), which matches what the itr8 Prototype Bridge skill asks for.
  - `image-node-dropzone`, `image-editor-canvas` — the two nodes with
    nontrivial interactive canvases inside them.

## What it does NOT report

No prompt text, image bytes, blob ids, or API keys are ever sent through
`updateModelContext`. Only structural/selection state (node type, id, counts)
is reported — see the itr8 Prototype Bridge skill's "Good context to send"
guidance, which this follows.

## Reviewing this app in itr8

1. `npm run dev` inside `nodes/`.
2. Create a web preview pointed at `http://localhost:3000` (or whichever
   port you used) from a **local dev server**, not a cloud sandbox — local
   previews give agents durable semantic state from the actually-running app.
3. Click nodes on the canvas; itr8 agents will see the selection reflected in
   model context without needing a fresh screenshot each time.
4. Agent-injected annotations (via `runtime_surface__annotate`) will resolve
   against the `data-itr8-id` attributes above.

## Production cleanup

If you ever ship this outside of itr8 review, the bridge is pure dev
instrumentation and safe to remove:

- Delete the injected `<script>` block in `src/app/layout.tsx`.
- Delete the `onSelectionChange` bridge-reporting call in
  `src/components/Canvas.tsx` (the rest of `onSelectionChange`'s body does
  nothing else, so you can remove the whole prop if you don't need it for
  anything else).
- The `data-itr8-id` attributes are harmless to leave in place — they're
  inert `data-*` attributes with no runtime behavior — but you can also treat
  them as ad-hoc test ids and keep them for your own E2E tests (see
  `itr8-tests/reve-nodes-demo.md`).
