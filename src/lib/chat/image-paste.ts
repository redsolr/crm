/**
 * Clipboard-image helpers for the Ask composer (founder 2026-08-04:
 * Ctrl+V a screenshot → the model reads it). Pure module — the DOM
 * paste event provides `DataTransferItemList`; everything here is
 * testable without React.
 *
 * Constraints are deliberately tight for an internal tool: screenshots
 * ride the request as data URLs (no upload pipeline), so a small cap
 * keeps request bodies sane.
 */

export const MAX_PASTED_IMAGES = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

/** Server + client agree on this shape — nothing else is forwarded to
 *  the model. */
export const IMAGE_DATA_URL_PATTERN =
  /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/** A data URL's base64 payload is ~4/3 of the byte size — the server
 *  re-checks against this character budget. */
export const MAX_IMAGE_DATA_URL_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64;

/** Files from a paste event worth attaching (accepted image types,
 *  within the byte cap). */
export function extractPastedImages(
  items: ArrayLike<{ kind: string; type: string; getAsFile(): File | null }>,
): File[] {
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item || item.kind !== "file" || !ACCEPTED_TYPES.has(item.type)) {
      continue;
    }
    const file = item.getAsFile();
    if (file === null) continue;
    if (file.size > MAX_IMAGE_BYTES) continue;
    files.push(file);
  }
  return files;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read pasted image"));
    reader.readAsDataURL(file);
  });
}

/** True when the string is an acceptable image payload for the wire. */
export function isValidImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_IMAGE_DATA_URL_LENGTH &&
    IMAGE_DATA_URL_PATTERN.test(value)
  );
}
