import type { Action } from "redux";
import { describe, expect, it, vi } from "vitest";

import type { IState } from "../../../../types/IState";
import type Debouncer from "../../../../util/Debouncer";
import { deployPendingOnAutoApply } from "./deployPendingOnAutoApply";

type ActivityAction = Action & { payload: { group: string; activityId: string } };

const setup = (needToDeploy: Record<string, boolean>, modsActivity: string[] = []) => {
  const dispatch = vi.fn<(action: ActivityAction) => void>();
  const state = {
    settings: { profiles: { activeProfileId: "default" } },
    session: { base: { activity: { mods: modsActivity } } },
    persistent: {
      profiles: { default: { id: "default", gameId: "skyrimse" } },
      deployment: { needToDeploy },
    },
  } as unknown as IState;
  const schedule = vi.fn<Debouncer["schedule"]>();
  const api = { store: { dispatch }, getState: () => state };

  return { onChange: deployPendingOnAutoApply(api, { schedule }), dispatch, schedule };
};

const activities = (dispatch: ReturnType<typeof setup>["dispatch"]) =>
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

    schedule.mock.calls[0][0]?.(null);
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

  it("does nothing when a deploy is already under way", () => {
    const { onChange, dispatch, schedule } = setup({ skyrimse: true }, ["deployment"]);

    onChange(false, true);

    expect(schedule).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does nothing when auto-apply is turned off, or was already on", () => {
    const { onChange, schedule } = setup({ skyrimse: true });

    onChange(true, false);
    onChange(true, true);
    onChange(undefined, false);

    expect(schedule).not.toHaveBeenCalled();
  });
});
