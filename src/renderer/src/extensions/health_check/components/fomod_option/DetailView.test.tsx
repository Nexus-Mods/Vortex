import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { healthCheckT } from "@/test-utils/healthCheckStrings";
import type { IExtensionApi } from "@/types/IExtensionContext";

const mocks = vi.hoisted(() => ({
  gameId: "skyrimse" as string | undefined,
  changeInstallerOptions: vi.fn(),
}));

vi.mock("react-redux", () => ({ useSelector: () => mocks.gameId }));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () =>
    Object.assign([healthCheckT, undefined, true], {
      t: healthCheckT,
      i18n: undefined,
      ready: true,
    }),
}));

vi.mock("../../utils/fomodSnapshot/changeInstallerOptions", () => ({
  changeInstallerOptions: mocks.changeInstallerOptions,
}));

import type { IFomodOptionIssue } from "../../checks/fomodOptionsCheck";
import type { IHealthCheckEntry } from "../../views/content/types";
import { DetailView } from "./DetailView";

const issue = (collectionManaged: boolean): IFomodOptionIssue => ({
  modId: "mod-a",
  modName: "Mod A",
  collectionManaged,
  options: [
    {
      stepName: "Compat",
      groupName: "Patches",
      optionName: "Patch for Mod B",
      wasType: "NotUsable",
      nowType: "Required",
      reason: "b.esp",
    },
  ],
});

const entryFor = (collectionManaged: boolean): IHealthCheckEntry => ({
  id: "mod-a",
  checkId: "check-fomod-option-availability",
  severity: "suggestion",
  resolutionType: "reinstall",
  data: issue(collectionManaged),
});

const api = {
  getState: () => ({ persistent: { mods: { skyrimse: { "mod-a": { id: "mod-a" } } } } }),
  showErrorNotification: vi.fn(),
  events: { emit: vi.fn() },
} as unknown as IExtensionApi;

const renderDetail = (collectionManaged: boolean, onBack = vi.fn()) => {
  render(<DetailView api={api} entry={entryFor(collectionManaged)} onBack={onBack} />);

  return { onBack };
};

describe("fomod option DetailView", () => {
  beforeEach(() => {
    mocks.gameId = "skyrimse";
    mocks.changeInstallerOptions.mockReset().mockResolvedValue(true);
  });

  it("offers Change options for a mod the user installed themselves", () => {
    renderDetail(false);

    expect(screen.getByRole("button", { name: "Change options" })).toBeVisible();
  });

  it("offers no action for a collection-managed mod, only the explanation", () => {
    // Reinstalling it would put the install out of step with the collection, which is a
    // decision the user has to make knowingly rather than by clicking a fix.
    renderDetail(true);

    expect(screen.queryByRole("button", { name: "Change options" })).toBeNull();
    expect(screen.getByText(/managed by a collection/)).toBeVisible();
  });

  it("names the option and the plugin that released it", () => {
    renderDetail(false);

    expect(screen.getByText("Patch for Mod B")).toBeVisible();
    expect(screen.getByText("Patches · available now that b.esp is active")).toBeVisible();
  });

  it("returns to the listing once the installer ran", async () => {
    const { onBack } = renderDetail(false);

    fireEvent.click(screen.getByRole("button", { name: "Change options" }));

    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(mocks.changeInstallerOptions).toHaveBeenCalledWith(api, { id: "mod-a" });
  });

  it("stays put when the user cancelled the installer", async () => {
    mocks.changeInstallerOptions.mockResolvedValue(false);
    const { onBack } = renderDetail(false);

    fireEvent.click(screen.getByRole("button", { name: "Change options" }));

    await waitFor(() => expect(mocks.changeInstallerOptions).toHaveBeenCalled());
    expect(onBack).not.toHaveBeenCalled();
  });

  it("does nothing when no game is active, rather than throwing", async () => {
    mocks.gameId = undefined;
    const { onBack } = renderDetail(false);

    fireEvent.click(screen.getByRole("button", { name: "Change options" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Change options" })).toBeEnabled(),
    );
    expect(mocks.changeInstallerOptions).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});
