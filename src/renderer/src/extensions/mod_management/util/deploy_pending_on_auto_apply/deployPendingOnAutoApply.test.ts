import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "../../../../types/IExtensionContext";
import type Debouncer from "../../../../util/Debouncer";
import { deployPendingOnAutoApply } from "./deployPendingOnAutoApply";

const setup = (needToDeploy: Record<string, boolean>) => {
  const dispatch = vi.fn();
  const api = {
    store: { dispatch },
    getState: () => ({
      settings: { profiles: { activeProfileId: "default" } },
      persistent: {
        profiles: { default: { id: "default", gameId: "skyrimse" } },
        deployment: { needToDeploy },
      },
    }),
  } as unknown as IExtensionApi;
  const schedule = vi.fn();
  const timer = { schedule } as unknown as Debouncer;

  return { onChange: deployPendingOnAutoApply(api, timer), dispatch, schedule };
};

const activities = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.map(([action]) => action.payload);

describe("deployPendingOnAutoApply", () => {
  it("deploys what's pending when auto-apply is turned on, shown as under way", () => {
    const { onChange, dispatch, schedule } = setup({ skyrimse: true });

    onChange(false, true);

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), false);
    expect(activities(dispatch)).toContainEqual({
      group: "mods",
      activityId: "deployment_pending",
    });

    schedule.mock.calls[0][0]();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("does nothing when nothing is pending", () => {
    const { onChange, dispatch, schedule } = setup({ skyrimse: false });

    onChange(false, true);

    expect(schedule).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing when only another game has changes pending", () => {
    const { onChange, schedule } = setup({ fallout4: true });

    onChange(false, true);

    expect(schedule).not.toHaveBeenCalled();
  });

  it("does nothing when auto-apply is turned off, or was already on", () => {
    const { onChange, schedule } = setup({ skyrimse: true });

    onChange(true, false);
    onChange(true, true);
    onChange(undefined, false);

    expect(schedule).not.toHaveBeenCalled();
  });
});
