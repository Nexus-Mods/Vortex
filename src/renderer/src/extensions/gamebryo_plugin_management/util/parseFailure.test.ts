import { describe, expect } from "vitest";

import { startActivity } from "../../../actions/session";
import { makePlugin } from "../../../test-utils/builders";
import { test } from "../../../test-utils/gamebryoTest";
import { parseFailureAttributes, ParseFailures } from "./parseFailure";
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

describe("ParseFailures", () => {
  const invalid = () => Object.assign(new Error("invalid file type"), { code: "EINVAL" });

  test("reports a plugin that fails to parse once, however often it is parsed", () => {
    const failures = new ParseFailures();

    expect(failures.failed("Data/One.esp", invalid())).toBe("report");
    expect(failures.failed("Data/One.esp", invalid())).toBe("known");
    expect(failures.failed("Data/Two.esp", invalid())).toBe("report");
  });

  test("reports a plugin again once it failed a different way or parsed in between", () => {
    const failures = new ParseFailures();
    failures.failed("Data/One.esp", invalid());

    expect(failures.failed("Data/One.esp", new Error("no code"))).toBe("report");
    failures.parsed("Data/One.esp");
    expect(failures.failed("Data/One.esp", new Error("no code"))).toBe("report");
  });

  // a deployment or purge can take a file away after the list was built
  test("asks for a rescan instead of a report when the file is gone", () => {
    const failures = new ParseFailures();

    expect(failures.failed("Data/One.esp", fileMissing())).toBe("stale");
    // parsed again before the rescan ran
    expect(failures.failed("Data/One.esp", fileMissing())).toBe("stale");
    expect(failures.awaitingRescan()).toEqual(["Data/One.esp"]);
  });

  test("reports a missing file once when a rescan still lists it", () => {
    const failures = new ParseFailures();
    failures.failed("Data/One.esp", fileMissing());

    failures.rescanned(failures.awaitingRescan());

    expect(failures.awaitingRescan()).toEqual([]);
    expect(failures.failed("Data/One.esp", fileMissing())).toBe("report");
    expect(failures.failed("Data/One.esp", fileMissing())).toBe("known");
  });

  test("leaves a file that went missing during a rescan for the next one", () => {
    const failures = new ParseFailures();
    failures.failed("Data/One.esp", fileMissing());
    const beforeRescan = failures.awaitingRescan();
    failures.failed("Data/Two.esp", fileMissing());

    failures.rescanned(beforeRescan);

    expect(failures.awaitingRescan()).toEqual(["Data/Two.esp"]);
  });

  test("forgets the plugins the list no longer names", () => {
    const failures = new ParseFailures();
    failures.failed("Data/One.esp", invalid());
    failures.failed("Data/Two.esp", fileMissing());

    failures.retain(["Data/One.esp"]);

    expect(failures.awaitingRescan()).toEqual([]);
    expect(failures.failed("Data/One.esp", invalid())).toBe("known");
  });
});
