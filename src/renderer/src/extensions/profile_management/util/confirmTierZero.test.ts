import { describe, it, expect, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { UserCanceled } from "../../../util/CustomErrors";
import { setConfirmTierZero } from "../../gamemode_management/actions/settings";
import { confirmTierZero } from "./confirmTierZero";

function makeApi(opts: {
  confirmTierZero?: boolean;
  action?: string;
  input?: Record<string, boolean>;
}) {
  const showDialog = vi.fn().mockResolvedValue({
    action: opts.action ?? "profile_management:tierZero.manage",
    input: opts.input ?? {},
  });
  const dispatch = vi.fn();
  const api = {
    getState: () => ({ settings: { gameMode: { confirmTierZero: opts.confirmTierZero } } }),
    translate: (key: string) => key,
    showDialog,
    store: { dispatch },
  } as unknown as IExtensionApi;
  return { api, showDialog, dispatch };
}

describe("confirmTierZero", () => {
  it("rejects with UserCanceled on Cancel and does not dispatch", async () => {
    const { api, dispatch } = makeApi({
      action: "profile_management:tierZero.cancel",
      input: { confirm_tier_zero: true },
    });
    await expect(confirmTierZero(api)).rejects.toBeInstanceOf(UserCanceled);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches setConfirmTierZero(false) when the checkbox is ticked", async () => {
    const { api, dispatch } = makeApi({ input: { confirm_tier_zero: true } });
    await confirmTierZero(api);
    expect(dispatch).toHaveBeenCalledWith(setConfirmTierZero(false));
  });

  it("does not dispatch when the checkbox is not ticked", async () => {
    const { api, dispatch } = makeApi({ input: { confirm_tier_zero: false } });
    await confirmTierZero(api);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("shows the dialog when the setting is unset", async () => {
    const { api, showDialog } = makeApi({});
    await confirmTierZero(api);
    expect(showDialog).toHaveBeenCalledTimes(1);
  });

  it("skips the dialog when the setting is false", async () => {
    const { api, showDialog } = makeApi({ confirmTierZero: false });
    await confirmTierZero(api);
    expect(showDialog).not.toHaveBeenCalled();
  });
});
