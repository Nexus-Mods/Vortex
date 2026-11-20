import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flags: new Map<string, unknown>(),
  getFlag: vi.fn(),
  initialised: true,
}));

vi.mock("@/FlagService", () => ({
  FlagService: {
    get instance() {
      return mocks.initialised
        ? { flags: mocks.flags, getFlag: mocks.getFlag, subscribe: () => () => undefined }
        : undefined;
    },
  },
}));

const FLAG = "vortex-sta-574-login-prompt";

const flagOn = (on: boolean) => {
  mocks.flags.clear();
  if (on) {
    mocks.flags.set(FLAG, { name: FLAG });
  }
};

// The fixed cohort is module state, so each test gets a fresh copy of the module.
const load = async () => {
  vi.resetModules();
  return import("./loginPromptExperiment.js");
};

describe("login prompt cohort", () => {
  beforeEach(() => {
    mocks.initialised = true;
    mocks.getFlag.mockReset();
    mocks.getFlag.mockImplementation((name: string) => mocks.flags.get(name));
    flagOn(false);
  });

  it("is test when the flag is on, and control when it's off", async () => {
    const { loginPromptCohort } = await load();

    expect(loginPromptCohort()).toBe("control");
    flagOn(true);
    expect(loginPromptCohort()).toBe("test");
  });

  it("is control before flags are available", async () => {
    mocks.initialised = false;
    const { loginPromptCohort, fixLoginPromptCohort } = await load();

    expect(loginPromptCohort()).toBe("control");
    expect(fixLoginPromptCohort()).toBe("control");
  });

  it("keeps the fixed cohort when flags arrive later in the session", async () => {
    const { loginPromptCohort, fixLoginPromptCohort } = await load();

    expect(fixLoginPromptCohort()).toBe("control");
    flagOn(true);

    expect(loginPromptCohort()).toBe("control");
    expect(fixLoginPromptCohort()).toBe("control");
  });

  it("counts one flag evaluation for Unleash, however often the cohort is read", async () => {
    flagOn(true);
    const { loginPromptCohort, fixLoginPromptCohort } = await load();

    loginPromptCohort();
    fixLoginPromptCohort();
    fixLoginPromptCohort();
    loginPromptCohort();

    expect(mocks.getFlag).toHaveBeenCalledOnce();
  });
});
