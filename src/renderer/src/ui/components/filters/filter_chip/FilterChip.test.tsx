import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterChip } from "./FilterChip";

describe("FilterChip", () => {
  it("takes its filter off from its ×", async () => {
    const onRemove = vi.fn();
    render(
      <FilterChip
        icon="toggle_on"
        label="Enabled"
        panel={() => <div />}
        removeLabel="Clear"
        testId="chip"
        onRemove={onRemove}
      />,
    );

    await userEvent.click(screen.getByTestId("chip-remove"));

    expect(onRemove).toHaveBeenCalledOnce();
  });
});
