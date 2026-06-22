import { render, cleanup } from "@testing-library/react";
import React from "react";
import { useSelector } from "react-redux";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { AdultAwareImage } from "./AdultAwareImage";

// react-redux is mocked so we can drive the logged-in user's preference directly.
vi.mock("react-redux", () => ({ useSelector: vi.fn() }));
// avoid pulling the real selector module (and its transitive deps) into the test.
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));

// --- Helpers ---

const mockUserInfo = (value: { adultBlurImages?: boolean } | undefined) => {
  (useSelector as unknown as ReturnType<typeof vi.fn>).mockReturnValue(value);
};

const renderComponent = (props: Partial<React.ComponentProps<typeof AdultAwareImage>> = {}) => {
  render(<AdultAwareImage alt="img" isAdult={true} src="x.png" {...props} />);
};

const getImg = () => document.querySelector("img");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

// --- Tests ---

describe("AdultAwareImage", () => {
  it("blurs adult content when the user opts into blurring", () => {
    mockUserInfo({ adultBlurImages: true });
    renderComponent();
    expect(getImg()).toHaveClass("blur-xl");
  });

  it("does not blur adult content when the user opts out", () => {
    mockUserInfo({ adultBlurImages: false });
    renderComponent();
    expect(getImg()).not.toHaveClass("blur-xl");
  });

  it("never blurs non-adult content", () => {
    mockUserInfo({ adultBlurImages: true });
    renderComponent({ isAdult: false });
    expect(getImg()).not.toHaveClass("blur-xl");
  });

  it("blurs adult content by default when no user is logged in", () => {
    mockUserInfo(undefined);
    renderComponent();
    expect(getImg()).toHaveClass("blur-xl");
  });
});
