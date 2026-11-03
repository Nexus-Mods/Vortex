import { describe, expect, it } from "vitest";

import { nxmModOutline } from "@/ui/icon-paths";

import { getIcon } from "./iconMap";

describe("getIcon", () => {
  it("maps the legacy names pages register with", () => {
    expect(getIcon("settings")).toBe("settings");
    expect(getIcon("game")).toBe("stadia_controller");
    expect(getIcon("mods")).toEqual({ path: nxmModOutline });
  });

  it("maps the legacy names toolbar actions register with", () => {
    expect(getIcon("deploy")).toBe("rocket_launch");
    expect(getIcon("open-ext")).toBe("folder_open");
  });

  it("falls back to category for a name it doesn't know", () => {
    expect(getIcon("not-an-icon")).toBe("category");
  });

  it("falls back to the given icon for a name it doesn't know", () => {
    expect(getIcon("not-an-icon", "extension")).toBe("extension");
  });
});
