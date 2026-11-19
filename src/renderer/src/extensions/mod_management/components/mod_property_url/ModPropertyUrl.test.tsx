import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ModPropertyUrl } from "./ModPropertyUrl";

const website = (onSave = vi.fn(), value = "") => (
  <ModPropertyUrl
    property={{ kind: "url", id: "website", label: "Website", value, modId: "a", onSave }}
  />
);

describe("ModPropertyUrl", () => {
  it("saves on leaving the box", async () => {
    const onSave = vi.fn();
    render(website(onSave));

    await userEvent.type(screen.getByRole("textbox"), "https://example.com");
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).toHaveBeenCalledWith("https://example.com");
  });

  it("doesn't save one that isn't an address, and says so", async () => {
    const onSave = vi.fn();
    render(website(onSave));

    await userEvent.type(screen.getByRole("textbox"), "not an address");
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("saves it cleared", async () => {
    const onSave = vi.fn();
    render(website(onSave, "https://example.com"));

    await userEvent.clear(screen.getByRole("textbox"));
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).toHaveBeenCalledWith("");
  });

  it("doesn't save the address it already has again", async () => {
    const onSave = vi.fn();
    render(website(onSave, "https://example.com"));

    await userEvent.type(screen.getByRole("textbox"), "x{Backspace}");
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("names its open button in a tooltip, not a title", async () => {
    render(website(vi.fn(), "https://example.com"));
    const open = screen.getByTestId("mod-property-open-website");

    expect(open).not.toHaveAttribute("title");
    await userEvent.hover(open);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });

  it("opens a valid address in the browser, and nothing else", async () => {
    const openUrl = vi.fn();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
    const { unmount } = render(website(vi.fn(), "https://example.com"));

    await userEvent.click(screen.getByTestId("mod-property-open-website"));
    expect(openUrl).toHaveBeenCalledWith("https://example.com");

    unmount();
    render(website(vi.fn(), ""));
    expect(screen.getByTestId("mod-property-open-website")).toBeDisabled();
    vi.unstubAllGlobals();
  });
});
