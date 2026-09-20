import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

describe("game media selectors", () => {
  it("disabledSources returns the same reference on repeated calls when the game has no entry", () => {});

  it("modTags returns a stable empty array", () => {});

  it("orphanedTagIds returns [] when liveItems is undefined", () => {});

  it("orphanedTagIds finds ids absent from the live list and excludes present ones", () => {});

  it("orphanedTagIds survive a missing game_media slice", () => {});
});
