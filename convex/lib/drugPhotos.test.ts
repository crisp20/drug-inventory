import { describe, expect, it } from "vitest";
import { dedupePhotos, parsePhotoName } from "./drugPhotos";

describe("parsePhotoName", () => {
  it("reads the Drug ID and type from the file name, including inside folders", () => {
    expect(parsePhotoName("25.jpg")).toEqual({ drugId: "25", contentType: "image/jpeg" });
    expect(parsePhotoName("photos/BRUo1.PNG")).toEqual({ drugId: "BRUo1", contentType: "image/png" });
  });

  it("ignores macOS copies, hidden files and non-images", () => {
    expect(parsePhotoName("__MACOSX/._25.jpg")).toBeNull();
    expect(parsePhotoName(".DS_Store")).toBeNull();
    expect(parsePhotoName("notes.txt")).toBeNull();
    expect(parsePhotoName(".jpg")).toBeNull();
  });
});

describe("dedupePhotos", () => {
  it("keeps the last photo per Drug ID and lists the others", () => {
    const { photos, duplicates } = dedupePhotos([
      { drugId: "25", fileName: "a/25.jpg" },
      { drugId: "30", fileName: "30.jpg" },
      { drugId: "25", fileName: "b/25.png" },
    ]);
    expect(photos.map((p) => p.fileName)).toEqual(["b/25.png", "30.jpg"]);
    expect(duplicates).toEqual(["a/25.jpg"]);
  });
});
