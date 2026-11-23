import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { healthCheckT } from "@/test-utils/healthCheckStrings";

import type { IFomodOptionIssue } from "../../checks/fomodOptionsCheck";
import type { IHealthCheckEntry } from "../../views/content/types";
import { ListingRow } from "./ListingRow";

// The row's job is what it says to the user, so it is rendered with the real English strings
// rather than the shared stub's keys.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () =>
    Object.assign([healthCheckT, undefined, true], {
      t: healthCheckT,
      i18n: undefined,
      ready: true,
    }),
}));

const option = (overrides: Partial<IFomodOptionIssue["options"][number]> = {}) => ({
  stepName: "Compat",
  groupName: "Patches",
  optionName: "Patch for Mod B",
  wasType: "NotUsable" as const,
  nowType: "Required" as const,
  reason: "b.esp",
  ...overrides,
});

const entryFor = (issue: IFomodOptionIssue): IHealthCheckEntry => ({
  id: issue.modId,
  checkId: "check-fomod-option-availability",
  severity: "suggestion",
  resolutionType: "reinstall",
  data: issue,
});

const renderRow = (options: IFomodOptionIssue["options"]) =>
  render(
    <ListingRow
      api={{} as never}
      entry={entryFor({
        modId: "mod-a",
        modName: "Mod A",
        collectionManaged: false,
        options,
      })}
      isHidden={false}
      onOpen={vi.fn()}
      onToggleHide={vi.fn()}
    />,
  );

describe("fomod option ListingRow", () => {
  it("names the group and option when one option became available", () => {
    renderRow([option()]);

    expect(screen.getByText("Mod A")).toBeVisible();
    expect(screen.getByText("Patches: Patch for Mod B")).toBeVisible();
    expect(screen.getByText("Available now that b.esp is active")).toBeVisible();
  });

  it("counts them when several did", () => {
    renderRow([option(), option({ optionName: "Patch for Mod C", reason: "c.esp" })]);

    expect(screen.getByText("2 options in Mod A")).toBeVisible();
    expect(
      screen.getByText(
        "Options that were unavailable when this mod was installed are available now",
      ),
    ).toBeVisible();
  });

  it("offers no hide or feedback controls, which this check cannot honour", () => {
    // There is no hide store and no feedback store for this check, so rendering the shared
    // controls would put three buttons on the row that do nothing.
    renderRow([option()]);

    expect(screen.queryByTestId("health-check-entry-hide")).toBeNull();
    expect(screen.queryByTestId("health-check-feedback-helpful")).toBeNull();
    expect(screen.queryByTestId("health-check-feedback-not-helpful")).toBeNull();
  });

  it("opens the mod's detail when Change options is clicked", () => {
    const onOpen = vi.fn();
    render(
      <ListingRow
        api={{} as never}
        entry={entryFor({
          modId: "mod-a",
          modName: "Mod A",
          collectionManaged: false,
          options: [option()],
        })}
        isHidden={false}
        onOpen={onOpen}
        onToggleHide={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Change options" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
