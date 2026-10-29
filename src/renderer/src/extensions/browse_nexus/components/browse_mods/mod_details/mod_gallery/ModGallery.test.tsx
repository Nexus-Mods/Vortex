import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ModGallery } from "./ModGallery";

// The user's adult content setting isn't needed here.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

describe("ModGallery", () => {
  it("shows its picture whole in a 16:9 frame, as the list's cards do", () => {
    const { container } = render(
      <ModGallery images={[{ src: "tall.png", thumbnail: "tall.png" }]} isAdult={false} />,
    );
    const img = container.querySelector("img")!;

    expect(img.closest(".nxm-image")).toHaveClass("nxm-image-mod");
    expect(img).toHaveClass("nxm-image-media-contain");
  });
});
