import { beforeEach, describe, expect, it } from "vitest";
import {
  LAYOUT_DOWNLOAD_TTL_MS,
  MAX_LAYOUT_DOWNLOAD_BYTES,
  LayoutDownloadError,
  isLayoutDownloadKey,
  validateLayoutDownloadDraft,
} from "./layoutDownload";
import {
  cleanupLayoutDownloads,
  deleteLayoutDownload,
  getLayoutDownload,
  putLayoutDownload,
} from "./layoutDownloadStore";

const KEY = "11111111-1111-4111-8111-111111111111";

beforeEach(() => cleanupLayoutDownloads(Number.MAX_SAFE_INTEGER));

describe("layout download payload validation", () => {
  it("accepts UUID keys and sanitizes filenames", () => {
    expect(isLayoutDownloadKey(KEY)).toBe(true);
    expect(isLayoutDownloadKey("../not-a-key")).toBe(false);
    expect(
      validateLayoutDownloadDraft({ text: '{"regions":[]}', filename: "../../my layout" }),
    ).toEqual({ text: '{"regions":[]}', filename: "my-layout.json" });
  });

  it("rejects malformed and oversized payloads", () => {
    expect(() => validateLayoutDownloadDraft(null)).toThrow(LayoutDownloadError);
    expect(() =>
      validateLayoutDownloadDraft({
        text: "x".repeat(MAX_LAYOUT_DOWNLOAD_BYTES + 1),
        filename: "huge.json",
      }),
    ).toThrow(/1MB limit/);
  });
});

describe("server-side layout download handoff store", () => {
  it("stores, reads, and deletes a valid short-lived payload", () => {
    const stored = putLayoutDownload(
      KEY,
      { text: '{"regions":[]}', filename: "reve-layout.json" },
      1000,
    );
    expect(stored.createdAt).toBe(1000);
    expect(getLayoutDownload(KEY, 1001)).toEqual(stored);
    expect(deleteLayoutDownload(KEY)).toBe(true);
    expect(getLayoutDownload(KEY, 1001)).toBeNull();
  });

  it("expires payloads after five minutes", () => {
    putLayoutDownload(KEY, { text: "{}", filename: "layout.json" }, 1000);
    expect(getLayoutDownload(KEY, 1000 + LAYOUT_DOWNLOAD_TTL_MS)).not.toBeNull();
    expect(getLayoutDownload(KEY, 1000 + LAYOUT_DOWNLOAD_TTL_MS + 1)).toBeNull();
  });

  it("rejects invalid keys", () => {
    expect(() => putLayoutDownload("../bad", { text: "{}", filename: "x.json" }))
      .toThrow(/Invalid layout download key/);
    expect(() => getLayoutDownload("bad")).toThrow(/Invalid layout download key/);
  });

  it("bounds the in-memory store at 32 entries by evicting the oldest", () => {
    const keyFor = (index: number) =>
      `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
    for (let index = 0; index < 33; index += 1) {
      putLayoutDownload(
        keyFor(index),
        { text: `{\"index\":${index}}`, filename: `layout-${index}.json` },
        10_000 + index,
      );
    }
    expect(getLayoutDownload(keyFor(0), 10_100)).toBeNull();
    expect(getLayoutDownload(keyFor(32), 10_100)?.filename).toBe("layout-32.json");
  });
});
