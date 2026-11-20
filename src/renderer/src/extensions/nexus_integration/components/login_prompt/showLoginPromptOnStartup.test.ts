import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cohort: "test" as "test" | "control" }));

vi.mock("../../experiments/loginPromptExperiment", () => ({
  fixLoginPromptCohort: () => mocks.cohort,
}));

import { setDialogVisible } from "@/actions";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { LOGIN_PROMPT_ID } from "./LoginPrompt";
import { showLoginPromptOnStartup } from "./showLoginPromptOnStartup";

interface IFakeState {
  loggedIn?: boolean;
  suppressed?: boolean;
  visibleDialog?: string;
  shownDialogs?: number;
}

const makeApi = ({
  loggedIn = false,
  suppressed = false,
  visibleDialog,
  shownDialogs = 0,
}: IFakeState) => {
  const dispatch = vi.fn();
  const state = {
    confidential: {
      account: { nexus: loggedIn ? { OAuthCredentials: { token: "t" } } : {} },
    },
    settings: { notifications: { suppress: suppressed ? { [LOGIN_PROMPT_ID]: true } : {} } },
    session: {
      base: { visibleDialog },
      notifications: { dialogs: Array.from({ length: shownDialogs }, (_, i) => ({ id: `d${i}` })) },
    },
  };
  const api = {
    getState: () => state,
    awaitUI: () => Promise.resolve(),
    store: { dispatch },
  } as unknown as IExtensionApi;
  return { api, dispatch };
};

describe("showLoginPromptOnStartup", () => {
  beforeEach(() => {
    mocks.cohort = "test";
  });

  it("doesn't show it to the experiment's control cohort", async () => {
    mocks.cohort = "control";
    const { api, dispatch } = makeApi({});

    await showLoginPromptOnStartup(api);

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("shows the prompt to a logged-out user", async () => {
    const { api, dispatch } = makeApi({});

    await showLoginPromptOnStartup(api);

    expect(dispatch).toHaveBeenCalledWith(setDialogVisible(LOGIN_PROMPT_ID));
  });

  it.each<[string, IFakeState]>([
    ["the user is logged in", { loggedIn: true }],
    ["the user ticked 'Don't show this again'", { suppressed: true }],
    ["another dialog is already open", { visibleDialog: "login-dialog" }],
    ["a dialog from api.showDialog is open", { shownDialogs: 1 }],
  ])("doesn't show it when %s", async (_, fake) => {
    const { api, dispatch } = makeApi(fake);

    await showLoginPromptOnStartup(api);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
