import { parseLayoutJson, stringifyLayout } from "./layoutEditing";
import type { Layout } from "./types";

export const MAX_LAYOUT_FILE_BYTES = 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".tif",
  ".tiff",
  ".avif",
]);

export interface ImportFileLike {
  name: string;
  type: string;
  size: number;
  text(): Promise<string>;
}

export type ImportFileKind = "image" | "layout";

export type LayoutFileImportResult =
  | { ok: true; draft: string; layout: Layout }
  | { ok: false; error: string; draft?: string };

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

/** Classifies a dropped file without trusting its MIME alone. Authoritative
 * image validation still happens in the blob route by magic number. */
export function classifyImportFile(
  file: Pick<ImportFileLike, "name" | "type">,
): ImportFileKind | null {
  const ext = extension(file.name);
  if (ext === ".json" || file.type === "application/json" || file.type === "text/json") {
    return "layout";
  }
  if (file.type.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) {
    return "image";
  }
  return null;
}

export function validateLayoutFileClientSide(
  file: Pick<ImportFileLike, "name" | "type" | "size">,
): string | null {
  if (classifyImportFile(file) !== "layout") {
    return "Choose a JSON file containing a Reve layout.";
  }
  if (file.size > MAX_LAYOUT_FILE_BYTES) {
    return `Layout file is ${(file.size / (1024 * 1024)).toFixed(1)}MB; the limit is 1MB.`;
  }
  return null;
}

/** Reads, parses, and schema-validates a layout file. Invalid content is
 * returned as a draft so a Layout Editor can show and repair it, but it never
 * becomes downstream output until it validates. */
export async function importLayoutFile(file: ImportFileLike): Promise<LayoutFileImportResult> {
  const metadataError = validateLayoutFileClientSide(file);
  if (metadataError) return { ok: false, error: metadataError };

  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return { ok: false, error: "The layout file could not be read." };
  }

  try {
    const layout = parseLayoutJson(raw);
    return { ok: true, layout, draft: stringifyLayout(layout) };
  } catch (error) {
    return {
      ok: false,
      draft: raw,
      error: error instanceof Error ? error.message : "Invalid layout JSON.",
    };
  }
}
