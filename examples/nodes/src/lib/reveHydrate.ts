// Converts between our internal DTOs (which reference images by local
// `blobId`) and the wire shapes Reve's API actually expects/returns (which
// carry inline base64). This is the server-side "hydrate before send,
// persist after receive" boundary — mirrors m3's hydrateBlobsInPlace /
// persistBlobsInPlace, simplified because our DTOs are structured (not a
// generic walk over an arbitrary blob) since we know exactly which fields
// can carry an image at each of the four endpoints.

import { saveBlobFromBase64, readBlobAsBase64 } from "./blobStore";
import type {
  CompoundReference,
  CompoundReferenceDTO,
  ImageInputDTO,
  ImageRef,
  Layout,
  RawImageInput,
} from "./types";

/**
 * Reve's extract_layout response can use sentinel parent values such as
 * "N/A", but create_layout/render_layout require every parent to name a
 * different region in the same layout. Clean only invalid parent pointers at
 * the final upstream boundary so extracted JSON stays inspectable/editable.
 */
export function sanitizeLayoutForReve(layout: Layout): Layout {
  const labels = new Set(layout.regions.map((region) => region.label));
  const regions = layout.regions.map((region) => {
    if (
      region.parent === undefined ||
      (region.parent !== region.label && labels.has(region.parent))
    ) {
      return region;
    }

    const { parent: _invalidParent, ...withoutParent } = region;
    return withoutParent;
  });

  return { ...layout, regions };
}

export async function hydrateImageInput(dto: ImageInputDTO): Promise<RawImageInput> {
  const data = await readBlobAsBase64(dto.blobId);
  return { data };
}

export async function hydrateCompoundReference(
  dto: CompoundReferenceDTO,
): Promise<CompoundReference> {
  const out: CompoundReference = {};
  if (dto.image) out.image = await hydrateImageInput(dto.image);
  if (dto.layout) out.layout = sanitizeLayoutForReve(dto.layout);
  if (dto.prompt) out.prompt = dto.prompt;
  return out;
}

export async function hydrateCompoundReferences(
  dtos: CompoundReferenceDTO[] | undefined,
): Promise<CompoundReference[] | undefined> {
  if (!dtos || dtos.length === 0) return undefined;
  return Promise.all(dtos.map(hydrateCompoundReference));
}

export async function hydrateRawImageInputs(
  dtos: ImageInputDTO[] | undefined,
): Promise<RawImageInput[] | undefined> {
  if (!dtos || dtos.length === 0) return undefined;
  return Promise.all(dtos.map(hydrateImageInput));
}

/** Persists a base64 image returned by Reve into the local blob store and
 * returns the small reference the client should hold instead. */
export async function persistResponseImage(
  base64: string | undefined | null,
): Promise<ImageRef | undefined> {
  if (!base64) return undefined;
  // Reve's JSON response always encodes images as PNG (see docs: "base64
  // encoded (png)"), regardless of the endpoint.
  const { id, mediaType } = await saveBlobFromBase64(base64, "image/png");
  return { id, mediaType };
}
