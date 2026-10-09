import { describe, expect, it } from "vitest";

import { lateResourceAttributes, setTelemetryInstanceId } from "./state";

describe("lateResourceAttributes", () => {
  it("names the install once its instance id is known", () => {
    expect(lateResourceAttributes()).toEqual({});

    setTelemetryInstanceId("inst-1");

    expect(lateResourceAttributes()).toEqual({ "service.state.id": "inst-1" });
  });
});
