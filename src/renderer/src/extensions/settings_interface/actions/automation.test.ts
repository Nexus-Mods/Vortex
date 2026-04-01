import { describe, it, expect } from "vitest";

import * as automationActions from "./automation";

describe("setAutoDeployment", () => {
  it("seta Auto Deployment", () => {
    expect(automationActions.setAutoDeployment(true)).toEqual({
      error: false,
      type: "SET_AUTO_DEPLOYMENT",
      payload: true,
    });
  });
});
