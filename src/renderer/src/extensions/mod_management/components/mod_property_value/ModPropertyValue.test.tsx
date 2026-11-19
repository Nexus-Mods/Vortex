import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { toast } from "react-hot-toast";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModPropertyValue } from "./ModPropertyValue";

const renderValue = (copyable = true) =>
  render(
    <ModPropertyValue
      property={{ kind: "value", id: "nexusModId", label: "Mod ID", value: "1234", copyable }}
    />,
  );

const stubClipboard = (writeText: (text: string) => Promise<void>) =>
  vi.stubGlobal("api", { ...window.api, clipboard: { writeText } });

describe("ModPropertyValue", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows its value under its label", () => {
    renderValue();

    expect(screen.getByTestId("mod-property-nexusModId")).toHaveTextContent("1234");
  });

  it("shows the whole value as a title, unless it's told not to", () => {
    const { unmount } = renderValue();
    expect(
      screen.getByTestId("mod-property-nexusModId").querySelector(".truncate"),
    ).toHaveAttribute("title", "1234");
    unmount();

    render(
      <ModPropertyValue
        property={{ kind: "value", id: "version", label: "Version", value: "1.0", hideTitle: true }}
      />,
    );
    expect(
      screen.getByTestId("mod-property-version").querySelector(".truncate"),
    ).not.toHaveAttribute("title");
  });

  it("names its copy button in a tooltip, not a title", async () => {
    renderValue();
    const copy = screen.getByTestId("mod-property-copy-nexusModId");

    expect(copy).not.toHaveAttribute("title");
    await userEvent.hover(copy);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });

  it("offers no copy where it isn't copyable", () => {
    renderValue(false);

    expect(screen.queryByTestId("mod-property-copy-nexusModId")).toBeNull();
  });

  it("copies its value, and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const success = vi.spyOn(toast, "success");
    renderValue();

    await userEvent.click(screen.getByTestId("mod-property-copy-nexusModId"));

    expect(writeText).toHaveBeenCalledWith("1234");
    await waitFor(() => expect(success).toHaveBeenCalled());
  });

  it("says so where the copy fails", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    const error = vi.spyOn(toast, "error");
    renderValue();

    await userEvent.click(screen.getByTestId("mod-property-copy-nexusModId"));

    await waitFor(() => expect(error).toHaveBeenCalled());
  });
});
