// Lightweight magic-number sniffing so uploaded files are validated by their
// actual bytes, not just the (spoofable) client-supplied Content-Type. Only
// the formats Reve's API documents as supported input are recognized.

const SIGNATURES: Array<{ mediaType: string; check: (b: Buffer) => boolean }> = [
  {
    mediaType: "image/png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mediaType: "image/jpeg",
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mediaType: "image/gif",
    check: (b) =>
      b.length >= 6 &&
      b.subarray(0, 4).toString("ascii") === "GIF8" &&
      (b[4] === 0x37 || b[4] === 0x39) &&
      b[5] === 0x61,
  },
  {
    mediaType: "image/webp",
    check: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  {
    mediaType: "image/tiff",
    check: (b) =>
      b.length >= 4 &&
      ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
        (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)),
  },
  {
    mediaType: "image/avif",
    check: (b) =>
      b.length >= 12 &&
      b.subarray(4, 8).toString("ascii") === "ftyp" &&
      ["avif", "avis", "mif1"].includes(b.subarray(8, 12).toString("ascii")),
  },
];

/** Returns the sniffed media type, or null if the bytes don't match any
 * format the Reve API documents as accepted input. */
export function sniffImageMediaType(bytes: Buffer): string | null {
  for (const sig of SIGNATURES) {
    if (sig.check(bytes)) return sig.mediaType;
  }
  return null;
}
