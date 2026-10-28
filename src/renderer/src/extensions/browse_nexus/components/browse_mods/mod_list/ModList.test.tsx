import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { MODS_PER_PAGE } from "../../../hooks/use_mod_search/useModSearch.hook";
import { ModList } from "./ModList";

const renderComponent = (props: Partial<React.ComponentProps<typeof ModList>> = {}) => {
  const onRetry = vi.fn();
  const onPageChange = vi.fn();

  render(
    <ModList
      activeModId={undefined}
      currentPage={2}
      detailsRef={createRef()}
      isError={false}
      isLoading={false}
      mods={[]}
      totalCount={100}
      onPageChange={onPageChange}
      onRetry={onRetry}
      onSelectMod={vi.fn()}
      {...props}
    />,
  );

  return { onRetry, onPageChange };
};

describe("ModList", () => {
  it("keeps its pages to move off a page that failed", async () => {
    const { onPageChange } = renderComponent({ isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Go to page 1" }));

    expect(onPageChange).toHaveBeenCalledWith(1, MODS_PER_PAGE);
  });

  it("offers to try a failed page again", async () => {
    const { onRetry } = renderComponent({ isError: true });

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalled();
  });
});
