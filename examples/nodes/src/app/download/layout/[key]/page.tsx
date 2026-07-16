"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { hasSaveFilePicker, saveJsonWithPicker } from "@/lib/fileSave";
import {
  validateLayoutDownloadDraft,
  type LayoutDownloadPayload,
} from "@/lib/layoutDownload";

const PREPARE_TIMEOUT_MS = 8_000;
const POLL_INTERVAL_MS = 120;

export default function LayoutDownloadHandoffPage() {
  const params = useParams<{ key: string }>();
  const key = typeof params.key === "string" ? params.key : "";
  const [payload, setPayload] = useState<LayoutDownloadPayload>();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let cancelled = false;

    async function loadPayload() {
      const deadline = Date.now() + PREPARE_TIMEOUT_MS;
      while (!cancelled) {
        try {
          const response = await fetch(`/api/layout-downloads/${encodeURIComponent(key)}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.ok) {
            const body = (await response.json()) as Partial<LayoutDownloadPayload>;
            const draft = validateLayoutDownloadDraft(body);
            if (cancelled) return;
            setPayload({
              ...draft,
              createdAt: typeof body.createdAt === "number" ? body.createdAt : Date.now(),
            });
            setError(undefined);
            return;
          }
          if (response.status !== 404) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error ?? "The layout download could not be read.");
          }
          if (Date.now() >= deadline) {
            throw new Error(
              "This layout download is missing or expired. Return to the node and try again.",
            );
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        } catch (loadError) {
          if (cancelled || (loadError instanceof DOMException && loadError.name === "AbortError")) {
            return;
          }
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The layout download could not be prepared.",
          );
          return;
        }
      }
    }

    void loadPayload();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key]);

  function removePayload() {
    if (!key) return;
    void fetch(`/api/layout-downloads/${encodeURIComponent(key)}`, {
      method: "DELETE",
      keepalive: true,
    });
  }

  async function saveLayout() {
    if (!payload) return;
    setError(undefined);
    setState("saving");
    try {
      await saveJsonWithPicker(payload.text, payload.filename);
      removePayload();
      setState("saved");
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") {
        setState("idle");
        return;
      }
      setState("idle");
      setError(saveError instanceof Error ? saveError.message : "The layout could not be saved.");
    }
  }

  async function copyLayout() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.text);
      setCopied(true);
      setError(undefined);
    } catch {
      setCopied(false);
      setError("Clipboard access was blocked. Select and copy the JSON below manually.");
    }
  }

  function closePage() {
    removePayload();
    window.close();
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white flex items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-xl border border-white/10 bg-[#15151c] p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-300/15 text-2xl">
          ↓
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">
            {state === "saved" ? "Layout saved" : "Save layout JSON"}
          </h1>
          <p className="text-sm text-white/55">
            {state === "saved"
              ? "The layout was written to the location you chose."
              : "This embedded preview blocks browser downloads. Choose a location and Chrome will save the layout there directly."}
          </p>
        </div>
        {!payload && !error && <p className="text-sm text-white/45">Preparing layout…</p>}
        {payload && hasSaveFilePicker() && (
          <button
            type="button"
            onClick={() => void saveLayout()}
            disabled={state === "saving"}
            className="inline-flex w-full items-center justify-center rounded bg-amber-300 px-4 py-2 text-sm font-medium text-[#0b0b0f] hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60"
            data-itr8-id="layout-download-handoff-save"
          >
            {state === "saving"
              ? "Saving…"
              : state === "saved"
                ? "Save another copy"
                : "Choose save location"}
          </button>
        )}
        {payload && !hasSaveFilePicker() && (
          <p className="text-sm text-amber-200">
            Chrome&apos;s save-file picker is unavailable. Copy the JSON below instead.
          </p>
        )}
        {error && <p className="text-sm text-red-300">{error}</p>}
        {payload && (
          <details className="text-left text-xs text-white/55" open={!hasSaveFilePicker()}>
            <summary className="cursor-pointer text-center underline underline-offset-4">
              Copy fallback
            </summary>
            <button
              type="button"
              onClick={() => void copyLayout()}
              className="mt-3 w-full rounded border border-white/15 bg-white/5 px-3 py-2 text-white/75 hover:bg-white/10"
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <textarea
              readOnly
              value={payload.text}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 h-48 w-full resize-y rounded border border-white/10 bg-black/30 p-2 font-mono text-[11px] text-white/65"
              aria-label="Layout JSON fallback"
            />
          </details>
        )}
        <button
          type="button"
          className="text-xs text-white/45 underline underline-offset-4 hover:text-white/70"
          onClick={closePage}
        >
          Close this tab
        </button>
      </section>
    </main>
  );
}
