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

function saveFilePicker(): SaveFilePicker | undefined {
  return (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
}

export function hasSaveFilePicker(): boolean {
  return Boolean(saveFilePicker());
}

/** Opens the native picker before any unrelated await so transient user
 * activation from the click is preserved. */
export async function saveJsonWithPicker(text: string, filename: string): Promise<void> {
  const picker = saveFilePicker();
  if (!picker) throw new Error("Chrome's save-file picker is unavailable.");

  const handle = await picker.call(window, {
    suggestedName: filename,
    types: [
      {
        description: "JSON layout",
        accept: { "application/json": [".json"] },
      },
    ],
  });
  const writable = await handle.createWritable();
  try {
    await writable.write(new Blob([text], { type: "application/json;charset=utf-8" }));
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
}

function triggerJsonDownload(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** For a genuine top-level page only. Embedded previews must use the handoff
 * route because their iframe sandbox blocks ordinary downloads. */
export async function saveJsonAtTopLevel(text: string, filename: string): Promise<void> {
  if (hasSaveFilePicker()) {
    await saveJsonWithPicker(text, filename);
    return;
  }
  triggerJsonDownload(text, filename);
}
