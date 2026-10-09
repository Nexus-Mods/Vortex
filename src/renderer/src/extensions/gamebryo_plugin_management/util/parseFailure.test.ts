import { describe, expect } from "vitest";

import { startActivity } from "../../../actions/session";
import { makePlugin } from "../../../test-utils/builders";
import { test } from "../../../test-utils/gamebryoTest";
import { parseFailureAttributes } from "./parseFailure";
import { SpanAttribute } from "./spanAttributes";

const fileMissing = () => Object.assign(new Error("file not found"), { code: "ENOENT" });

describe("parseFailureAttributes", () => {
  test("names the plugin and why it could not be read", ({ makeGamebryo }) => {
    const harness = makeGamebryo();

    const attributes = parseFailureAttributes(
      "one.esp",
      makePlugin(),
      fileMissing(),
      harness.getState(),
    );

    expect(attributes).toMatchObject({
      [SpanAttribute.PluginName]: "one.esp",
      [SpanAttribute.ErrorCode]: "ENOENT",
    });
  });

  // a plugin list scanned before a deployment can name files the deployment has since moved
  test("names the activities running when the plugin could not be read", ({ makeGamebryo }) => {
    const harness = makeGamebryo();
    harness.api.store.dispatch(startActivity("mods", "deployment"));
    harness.api.store.dispatch(startActivity("plugins", "update-plugin-list"));

    const attributes = parseFailureAttributes(
      "one.esp",
      makePlugin(),
      fileMissing(),
      harness.getState(),
    );

    expect(attributes).toMatchObject({
      [SpanAttribute.ActivityMods]: "deployment",
      [SpanAttribute.ActivityPlugins]: "update-plugin-list",
    });
  });

  test("tells a plugin read from staging from one read from the game folder", ({
    makeGamebryo,
  }) => {
    const harness = makeGamebryo();

    const attributes = parseFailureAttributes(
      "one.esp",
      makePlugin({ deployed: false }),
      fileMissing(),
      harness.getState(),
    );

    expect(attributes).toMatchObject({ [SpanAttribute.PluginDeployed]: false });
  });
});
