import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IUnavailableReason } from "../types/IDeploymentMethod";
import {
  outputDirectoryUnavailable,
  unavailableReasonActions,
  unavailableReasonText,
} from "./unavailableReason";

vi.mock("../../../logging", () => ({ log: vi.fn<() => void>() }));

/** Returns the english text with its placeholders filled in, as the real translation does. */
const t = ((text: string, options?: { replace?: Record<string, string> }) =>
  text.replace(/{{(\w+)}}/g, (_match, key: string) => options?.replace?.[key] ?? "")) as TFunction;

const MOD_PATH = "C:\\Games\\Some Game\\Data\\Mods";

function fsError(code: string): Error {
  return Object.assign(new Error(`${code}: ${MOD_PATH}`), { code });
}

describe("outputDirectoryUnavailable", () => {
  it("names the directory that doesn't exist", () => {
    const reason = outputDirectoryUnavailable(fsError("ENOENT"), MOD_PATH);

    expect(reason.description(t)).toBe(`Output directory "${MOD_PATH}" doesn't exist.`);
  });

  it("names the directory the user can't write to", () => {
    const reason = outputDirectoryUnavailable(fsError("EACCES"), MOD_PATH);

    expect(reason.description(t)).toBe(`Can't write to output directory "${MOD_PATH}".`);
    expect(reason.solution(t)).toContain(MOD_PATH);
  });
});

describe("unavailableReasonText", () => {
  it("follows the reason with its solution", () => {
    const reason: IUnavailableReason = {
      description: () => "Mods are on another drive.",
      solution: () => "Move the staging folder.",
    };

    expect(unavailableReasonText(t, reason)).toBe(
      "Mods are on another drive.\n\nMove the staging folder.",
    );
  });

  it("is just the reason when there is no solution", () => {
    expect(unavailableReasonText(t, { description: () => "Game not discovered." })).toBe(
      "Game not discovered.",
    );
  });
});

describe("unavailableReasonActions", () => {
  const api = {} as IExtensionApi;

  it("offers no button when the reason can't be fixed automatically", () => {
    expect(unavailableReasonActions(api, { description: () => "Game not discovered." })).toEqual(
      [],
    );
  });

  it("offers a button that closes the notification and applies the fix", () => {
    // a fix that only navigates to the settings page never settles
    const fixCallback = vi.fn<(api: IExtensionApi) => Promise<void>>(
      () => new Promise<void>(() => undefined),
    );
    const dismiss = vi.fn<() => void>();

    const actions = unavailableReasonActions(api, {
      description: () => "Mods are on another drive.",
      fixCallback,
    });
    actions[0].action(dismiss);

    expect(actions.map((action) => action.title)).toEqual(["Apply Fix"]);
    expect(dismiss).toHaveBeenCalled();
    expect(fixCallback).toHaveBeenCalledWith(api);
  });
});
