import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BBCode } from "@/ui/components/prose/bbcode/BBCode";

vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));
vi.mock("@/controls/Icon", () => ({
  default: ({ name }: { name: string }) => <svg data-testid="legacy-icon" data-name={name} />,
}));

describe("SvgTag", () => {
  it("draws a name the toolbar has an icon for as that icon", () => {
    // `rules` is the name the toolbar's file conflicts action registers with
    const { container, queryByTestId } = render(<BBCode bbcode="Check [svg]rules[/svg] here" />);

    expect(container.querySelector("[data-symbol='rule']")).not.toBeNull();
    expect(queryByTestId("legacy-icon")).toBeNull();
  });

  it("draws any other name from the legacy icon set", () => {
    const { container, getByTestId } = render(<BBCode bbcode="Check [svg]some-extension[/svg]" />);

    expect(getByTestId("legacy-icon")).toHaveAttribute("data-name", "some-extension");
    expect(container.querySelector("[data-symbol]")).toBeNull();
  });
});
