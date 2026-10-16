import { describe, expect, it } from "vitest";

import type { IGameStored } from "@/types/IState";

import type { IDiscoveryResult } from "../../types/IDiscoveryResult";
import { detectedInternalId } from "./detectedInternalId";

const game = (id: string, nexusPageId?: string): IGameStored => ({
  id,
  name: id,
  executable: undefined,
  extensionPath: undefined,
  requiredFiles: [],
  details: nexusPageId === undefined ? undefined : { nexusPageId },
});

// Games that share a Nexus page id, as the bundled extensions register them.
const known = [
  game("nwn", "neverwinter"),
  game("nwnee", "neverwinter"),
  game("fallout4"),
  game("fallout4vr", "fallout4"),
];

const installed = (...ids: string[]): { [gameId: string]: IDiscoveryResult } =>
  Object.fromEntries(ids.map((id) => [id, { path: `C:/Games/${id}` }]));

describe("detectedInternalId", () => {
  it("picks the installed one of two games that share a Nexus domain", () => {
    expect(detectedInternalId(known, installed("nwnee"), "neverwinter")).toBe("nwnee");
  });

  it("picks an installed edition over the game whose id is the domain", () => {
    expect(detectedInternalId(known, installed("fallout4vr"), "fallout4")).toBe("fallout4vr");
  });

  it("prefers the game whose id is the domain when both are installed", () => {
    expect(detectedInternalId(known, installed("fallout4vr", "fallout4"), "fallout4")).toBe(
      "fallout4",
    );
  });

  it("falls back to the first registered game when none is installed", () => {
    expect(detectedInternalId(known, {}, "neverwinter")).toBe("nwn");
  });
});
