import { describe, it, expect } from "vitest";

import { uploadHeadersFor } from "./uploadHeaders";

describe("uploadHeadersFor", () => {
  it("derives a content-disposition from the session filename", () => {
    expect(uploadHeadersFor("collection_1.7z")).toEqual({
      contentType: "application/octet-stream",
      contentDisposition: 'attachment; filename="collection_1.7z"',
    });
  });

  it("quotes the filename so spaces survive", () => {
    expect(uploadHeadersFor("my collection.7z").contentDisposition).toBe(
      'attachment; filename="my collection.7z"',
    );
  });
});
