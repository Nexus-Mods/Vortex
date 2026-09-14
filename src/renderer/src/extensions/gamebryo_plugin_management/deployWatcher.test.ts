import { describe, expect, vi } from "vitest";

import { setCollectionSession } from "../../test-utils/builders";
import { test } from "../../test-utils/gamebryoTest";
import type { IGamebryoHarness } from "../../test-utils/harnessTypes";
import { setPluginOrder } from "./actions/loadOrder";
import { startDeployWatcher } from "./deployWatcher";

function startWatcher(harness: IGamebryoHarness) {
  const onDidDeploy = vi.fn<(profileId: string) => Promise<void>>(() => Promise.resolve());
  const trigger = vi.fn<(check: string, delay: number) => void>();
  harness.api.events.on("trigger-test-run", trigger);
  const watcher = startDeployWatcher(harness.api, onDidDeploy);

  const didDeploy = (opts?: { isCollectionPostprocessCall?: boolean }): void => {
    harness.emit("did-deploy", "profile-1", {}, undefined, opts);
  };
  return { harness, watcher, onDidDeploy, trigger, didDeploy };
}

describe("startDeployWatcher", () => {
  test("emits the plugins-changed check when the load order changes outside a deployment", ({
    makeGamebryo,
  }) => {
    const { harness, trigger } = startWatcher(makeGamebryo());

    harness.api.store.dispatch(setPluginOrder(["a.esp"], true));

    expect(trigger).toHaveBeenCalledWith("plugins-changed", 500);
  });

  test("queues load-order changes during a deployment and emits the check once after it", ({
    makeGamebryo,
  }) => {
    const { harness, trigger, didDeploy } = startWatcher(makeGamebryo());

    harness.emit("will-deploy");
    harness.api.store.dispatch(setPluginOrder(["a.esp"], true));
    harness.api.store.dispatch(setPluginOrder(["b.esp", "a.esp"], true));
    expect(trigger).not.toHaveBeenCalled();

    didDeploy();
    expect(trigger).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveBeenCalledWith("plugins-changed", 500);

    // the queue drains on the deployment that closed it, not on later ones
    didDeploy();
    expect(trigger).toHaveBeenCalledTimes(1);
  });

  test("runs the deploy handler when a deployment finishes", ({ makeGamebryo }) => {
    const { onDidDeploy, didDeploy } = startWatcher(makeGamebryo());

    didDeploy();

    expect(onDidDeploy).toHaveBeenCalledWith("profile-1");
  });

  test("runs the deploy handler when a purge finishes", ({ makeGamebryo }) => {
    const { harness, onDidDeploy } = startWatcher(makeGamebryo());

    harness.emit("did-purge", "profile-1");

    expect(onDidDeploy).toHaveBeenCalledWith("profile-1");
  });

  test("leaves the deployment to the postprocess handler during a collection session", ({
    makeGamebryo,
  }) => {
    const { harness, onDidDeploy, didDeploy } = startWatcher(makeGamebryo());
    setCollectionSession(harness, true);

    didDeploy();

    expect(onDidDeploy).not.toHaveBeenCalled();
  });

  test("leaves a collection postprocess deployment to the postprocess handler", ({
    makeGamebryo,
  }) => {
    const { onDidDeploy, didDeploy } = startWatcher(makeGamebryo());

    didDeploy({ isCollectionPostprocessCall: true });

    expect(onDidDeploy).not.toHaveBeenCalled();
  });

  test("reports a deployment in progress until it finishes", ({ makeGamebryo }) => {
    const { harness, watcher, didDeploy } = startWatcher(makeGamebryo());

    expect(watcher.isDeploying()).toBe(false);
    harness.emit("will-deploy");
    expect(watcher.isDeploying()).toBe(true);
    didDeploy();
    expect(watcher.isDeploying()).toBe(false);
  });
});
