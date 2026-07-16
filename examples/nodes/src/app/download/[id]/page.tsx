"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type WritableFile = {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
};

type SaveFileHandle = {
  createWritable(): Promise<WritableFile>;
};

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<SaveFileHandle>;

function attachmentFilename(value: string | null, fallback: string) {
  const match = value?.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

export default function DownloadHandoffPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const downloadHref = id ? `/api/blobs/${encodeURIComponent(id)}?download=1` : undefined;
  const [filename, setFilename] = useState(id ? `reve-${id}.png` : "reve-image.png");
  const [absoluteDownloadUrl, setAbsoluteDownloadUrl] = useState<string>();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!downloadHref) return;
    setAbsoluteDownloadUrl(new URL(downloadHref, window.location.href).href);
    const controller = new AbortController();
    void fetch(downloadHref, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (response.ok) {
          setFilename((current) =>
            attachmentFilename(response.headers.get("content-disposition"), current),
          );
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [downloadHref]);

  async function saveImage() {
    if (!downloadHref) return;
    const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker })
      .showSaveFilePicker;
    if (!picker) {
      setError("Chrome's save-file picker is unavailable. Copy the download URL below and open it in a regular tab.");
      return;
    }

    setError(undefined);
    try {
      // Open the native picker before awaiting anything so the click's user
      // activation is preserved inside a sandbox-inherited popup.
      const handle = await picker.call(window, {
        suggestedName: filename,
        types: [
          {
            description: "Image",
            accept: {
              "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff", ".avif"],
            },
          },
        ],
      });
      setState("saving");

      const response = await fetch(downloadHref);
      if (!response.ok) throw new Error(`Image request failed (${response.status}).`);
      const blob = await response.blob();
      const writable = await handle.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
      } catch (writeError) {
        await writable.abort?.().catch(() => undefined);
        throw writeError;
      }
      setState("saved");
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") {
        setState("idle");
        return;
      }
      setState("idle");
      setError(saveError instanceof Error ? saveError.message : "The image could not be saved.");
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl border border-white/10 bg-[#15151c] p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-400/15 text-2xl">
          ↓
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">
            {state === "saved" ? "Image saved" : "Save image"}
          </h1>
          <p className="text-sm text-white/55">
            {state === "saved"
              ? "The image was written to the location you chose."
              : "This embedded preview blocks browser downloads. Choose a location and Chrome will save the image there directly."}
          </p>
        </div>
        {downloadHref ? (
          <button
            type="button"
            onClick={() => void saveImage()}
            disabled={state === "saving"}
            className="inline-flex w-full items-center justify-center rounded bg-blue-400 px-4 py-2 text-sm font-medium text-[#0b0b0f] hover:bg-blue-300 disabled:cursor-wait disabled:opacity-60"
            data-itr8-id="download-handoff-save"
          >
            {state === "saving"
              ? "Saving…"
              : state === "saved"
                ? "Save another copy"
                : "Choose save location"}
          </button>
        ) : (
          <p className="text-sm text-red-300">The image download URL is invalid.</p>
        )}
        {error && <p className="text-sm text-red-300">{error}</p>}
        {absoluteDownloadUrl && (
          <details className="text-left text-xs text-white/45">
            <summary className="cursor-pointer text-center underline underline-offset-4">
              Manual fallback
            </summary>
            <p className="mt-2">Copy this URL and paste it into a regular browser tab:</p>
            <input
              readOnly
              value={absoluteDownloadUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-1 w-full rounded border border-white/10 bg-black/30 p-2 text-white/65"
              aria-label="Direct image download URL"
            />
          </details>
        )}
        <button
          type="button"
          className="text-xs text-white/45 underline underline-offset-4 hover:text-white/70"
          onClick={() => window.close()}
        >
          Close this tab
        </button>
      </section>
    </main>
  );
}
