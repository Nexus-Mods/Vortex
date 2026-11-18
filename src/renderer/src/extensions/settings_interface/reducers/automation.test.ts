import { describe, it, expect } from "vitest";

import { setAutoDeployment } from "../actions/automation";
import automationReducer from "./automation";

describe("setAutoDeployment", () => {
  it("sets Auto Deployment", () => {
    const input = {
      deploy: false,
      install: false,
      enable: false,
      start: false,
      minimized: false,
    };
    const result = automationReducer.reducers.SET_AUTO_DEPLOYMENT(
      input,
      setAutoDeployment(true).payload,
    );
    expect(result).toEqual({
      deploy: true,
      install: false,
      enable: false,
      start: false,
      minimized: false,
    });
  });
});
