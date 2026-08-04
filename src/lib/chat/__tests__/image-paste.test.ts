import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DATA_URL_LENGTH,
  extractPastedImages,
  isValidImageDataUrl,
} from "../image-paste";

/** Minimal DataTransferItem stand-in. */
function item(
  kind: string,
  type: string,
  file: File | null,
): { kind: string; type: string; getAsFile(): File | null } {
  return { kind, type, getAsFile: () => file };
}

function fakeFile(size: number, type: string): File {
  return { size, type, name: "shot.png" } as File;
}

describe("extractPastedImages", () => {
  it("keeps accepted image files and drops everything else", () => {
    const png = fakeFile(1024, "image/png");
    const jpeg = fakeFile(2048, "image/jpeg");
    const files = extractPastedImages([
      item("file", "image/png", png),
      item("string", "text/plain", null),
      item("file", "application/pdf", fakeFile(10, "application/pdf")),
      item("file", "image/jpeg", jpeg),
      item("file", "image/svg+xml", fakeFile(10, "image/svg+xml")),
    ]);
    expect(files).toEqual([png, jpeg]);
  });

  it("drops images over the byte cap", () => {
    const files = extractPastedImages([
      item("file", "image/png", fakeFile(MAX_IMAGE_BYTES + 1, "image/png")),
    ]);
    expect(files).toEqual([]);
  });

  it("tolerates getAsFile returning null", () => {
    expect(extractPastedImages([item("file", "image/png", null)])).toEqual([]);
  });
});

describe("isValidImageDataUrl", () => {
  it("accepts png/jpeg/webp/gif data URLs", () => {
    for (const mime of ["png", "jpeg", "webp", "gif"]) {
      expect(isValidImageDataUrl(`data:image/${mime};base64,iVBORw0KGgo=`)).toBe(
        true,
      );
    }
  });

  it("rejects non-image and non-data payloads", () => {
    expect(isValidImageDataUrl("https://evil.example/x.png")).toBe(false);
    expect(isValidImageDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(
      false,
    );
    expect(isValidImageDataUrl("data:text/html;base64,PGI+aGk8L2I+")).toBe(
      false,
    );
    expect(isValidImageDataUrl(42)).toBe(false);
    expect(isValidImageDataUrl(null)).toBe(false);
  });

  it("rejects payloads over the character budget", () => {
    const huge = `data:image/png;base64,${"A".repeat(MAX_IMAGE_DATA_URL_LENGTH)}`;
    expect(isValidImageDataUrl(huge)).toBe(false);
  });
});
