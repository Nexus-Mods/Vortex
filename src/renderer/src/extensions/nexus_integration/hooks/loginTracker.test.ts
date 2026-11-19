import { EventEmitter } from "events";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

const experiment = vi.hoisted(() => ({ cohort: "test" as "test" | "control" }));

vi.mock("../experiments/loginPromptExperiment", () => ({
  loginPromptCohort: () => experiment.cohort,
}));

/** `consent` is the analytics setting, which tests flip to model consent given later. */
const makeApi = () => {
  const events = new EventEmitter();
  const tracked = vi.fn();
  events.on("analytics-track-mixpanel-event", tracked);
  const settings = { consent: true as boolean | undefined };
  const getState = () => ({ settings: { analytics: { enabled: settings.consent } } });
  return { api: { events, getState } as unknown as IExtensionApi, events, tracked, settings };
};

// The pending source is module state, so each test gets a fresh copy of the module.
const load = async () => {
  vi.resetModules();
  return import("./loginTracker.js");
};

describe("login tracking", () => {
  beforeEach(() => {
    vi.resetModules();
    experiment.cohort = "test";
  });

  it("sends the login's source once analytics starts", async () => {
    const { noteLoginCompleted, trackLoginsWhenAnalyticsStarts } = await load();
    const { api, events, tracked } = makeApi();
    trackLoginsWhenAnalyticsStarts(api);

    noteLoginCompleted(api, "startup_prompt");
    expect(tracked).not.toHaveBeenCalled();

    events.emit("analytics-started");

    expect(tracked).toHaveBeenCalledOnce();
    expect(tracked).toHaveBeenCalledWith({
      eventName: "app_login_completed",
      properties: { source: "startup_prompt", login_prompt_cohort: "test" },
    });
  });

  it("sends nothing when analytics starts without a login to report", async () => {
    const { trackLoginsWhenAnalyticsStarts } = await load();
    const { api, events, tracked } = makeApi();
    trackLoginsWhenAnalyticsStarts(api);

    events.emit("analytics-started");

    expect(tracked).not.toHaveBeenCalled();
  });

  it("sends a login only once, however often analytics restarts", async () => {
    const { noteLoginCompleted, trackLoginsWhenAnalyticsStarts } = await load();
    const { api, events, tracked } = makeApi();
    trackLoginsWhenAnalyticsStarts(api);

    noteLoginCompleted(api, "header");
    events.emit("analytics-started");
    events.emit("analytics-started");

    expect(tracked).toHaveBeenCalledOnce();
  });

  it("credits the latest login when an earlier one was never sent", async () => {
    const { noteLoginCompleted, trackLoginsWhenAnalyticsStarts } = await load();
    const { api, events, tracked } = makeApi();
    trackLoginsWhenAnalyticsStarts(api);

    noteLoginCompleted(api, "header");
    noteLoginCompleted(api, "health_check");
    events.emit("analytics-started");

    expect(tracked).toHaveBeenCalledWith({
      eventName: "app_login_completed",
      properties: { source: "health_check", login_prompt_cohort: "test" },
    });
  });

  it("doesn't send a login made before the user consented, even once they do", async () => {
    const { noteLoginCompleted, trackLoginsWhenAnalyticsStarts } = await load();
    const { api, events, tracked, settings } = makeApi();
    trackLoginsWhenAnalyticsStarts(api);

    settings.consent = undefined; // never asked: the consent prompt only follows a login
    noteLoginCompleted(api, "startup_prompt");
    settings.consent = true; // says yes at the prompt that follows
    events.emit("analytics-started");

    expect(tracked).not.toHaveBeenCalled();
  });

  it("drops an earlier held login when a later one is made without consent", async () => {
    const { noteLoginCompleted, trackLoginsWhenAnalyticsStarts } = await load();
    const { api, events, tracked, settings } = makeApi();
    trackLoginsWhenAnalyticsStarts(api);

    noteLoginCompleted(api, "header");
    settings.consent = false;
    noteLoginCompleted(api, "startup_prompt");
    settings.consent = true;
    events.emit("analytics-started");

    expect(tracked).not.toHaveBeenCalled();
  });

  it("reports the cohort the login was made in, even if it reads differently later", async () => {
    const { noteLoginCompleted, trackLoginsWhenAnalyticsStarts } = await load();
    const { api, events, tracked } = makeApi();
    trackLoginsWhenAnalyticsStarts(api);

    experiment.cohort = "control";
    noteLoginCompleted(api, "header");
    experiment.cohort = "test";
    events.emit("analytics-started");

    expect(tracked).toHaveBeenCalledWith({
      eventName: "app_login_completed",
      properties: { source: "header", login_prompt_cohort: "control" },
    });
  });
});
