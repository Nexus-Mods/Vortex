import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { type ILinkCandidate, LinkExtensionsDialog } from "./LinkExtensionsDialog";

const candidates: ILinkCandidate[] = [
  {
    key: "ext-1",
    name: "My weird custom extension",
    version: "0.5",
    replacementName: "Mount & Blade II: Bannerlord Support",
    replacementVersion: "2.0.0",
  },
  {
    key: "ext-2",
    name: "Cyberpunk 2077 Vortex Support",
    version: "0.13.0",
    replacementName: "Cyberpunk 2077 Vortex Support",
    replacementVersion: "0.13.1",
  },
];

const renderDialog = () => {
  const onAnswer = vi.fn();
  const onHide = vi.fn();
  render(
    <LinkExtensionsDialog
      candidates={candidates}
      visible={true}
      onAnswer={onAnswer}
      onHide={onHide}
    />,
  );
  return { onAnswer, onHide };
};

describe("LinkExtensionsDialog", () => {
  it("lists each extension with its replacement", () => {
    renderDialog();
    expect(screen.getByText("My weird custom extension v0.5")).toBeInTheDocument();
    expect(screen.getByText("Mount & Blade II: Bannerlord Support v2.0.0")).toBeInTheDocument();
  });

  it("selects every extension by default", async () => {
    const { onAnswer, onHide } = renderDialog();
    await userEvent.click(screen.getByTestId("link-extensions-update"));
    expect(onAnswer).toHaveBeenCalledWith(["ext-1", "ext-2"]);
    expect(onHide).toHaveBeenCalled();
  });

  it("leaves out the extensions the user unselected", async () => {
    const { onAnswer } = renderDialog();
    await userEvent.click(screen.getByTestId("link-extension-ext-1"));
    await userEvent.click(screen.getByTestId("link-extensions-update"));
    expect(onAnswer).toHaveBeenCalledWith(["ext-2"]);
  });

  it("answers nothing when put off", async () => {
    const { onAnswer, onHide } = renderDialog();
    await userEvent.click(screen.getByTestId("link-extensions-later"));
    expect(onAnswer).toHaveBeenCalledWith(undefined);
    expect(onHide).toHaveBeenCalled();
  });
});
