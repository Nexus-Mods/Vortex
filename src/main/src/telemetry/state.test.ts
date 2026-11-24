import { describe, expect, it } from "vitest";

import {
  getExportedTraceIds,
  lateResourceAttributes,
  recordExportedTrace,
  setTelemetryInstanceId,
} from "./state";

describe("lateResourceAttributes", () => {
  it("names the install once its instance id is known", () => {
    expect(lateResourceAttributes()).toEqual({});

    setTelemetryInstanceId("inst-1");

    expect(lateResourceAttributes()).toEqual({ "service.state.id": "inst-1" });
  });
});

describe("exported trace ids", () => {
  it("lists each exported trace once, oldest first, and forgets the oldest past 200", () => {
    recordExportedTrace("first");
    recordExportedTrace("second");
    recordExportedTrace("first");

    expect(getExportedTraceIds()).toEqual(["first", "second"]);

    for (let index = 0; index < 199; index++) {
      recordExportedTrace(`trace-${index}`);
    }

    const ids = getExportedTraceIds();
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe("second");
    expect(ids.at(-1)).toBe("trace-198");
  });
});
