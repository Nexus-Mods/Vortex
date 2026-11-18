import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EditedViewStrip } from "./EditedViewStrip";

const renderStrip = () => {
  const onReset = vi.fn();
  const onSave = vi.fn();
  render(
    <EditedViewStrip
      resetHint="reset hint"
      saveHint="save hint"
      viewLabel="All"
      onReset={onReset}
      onSave={onSave}
    />,
  );
  return { onReset, onSave };
};

describe("EditedViewStrip", () => {
  it("resets the view", async () => {
    const { onReset, onSave } = renderStrip();

    await userEvent.click(screen.getByTestId("edited-view-reset"));

    expect(onReset).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves it as a new view", async () => {
    const { onReset, onSave } = renderStrip();

    await userEvent.click(screen.getByTestId("edited-view-save"));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onReset).not.toHaveBeenCalled();
  });
});
