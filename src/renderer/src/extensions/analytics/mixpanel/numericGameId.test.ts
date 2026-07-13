/**
 * Tests for the shared numeric-game-id resolution used by the analytics events. This is the one
 * place the game-resolution globals (getGame / nexusGames / nexusGameId) are mocked; feature-level
 * analytics tests follow the harness convention and don't assert the resolved id.
 */
import { describe, expect, it, vi } from "vitest";

import { numericNexusGameId } from "./numericGameId";

vi.mock("../../gamemode_management/util/getGame", () => ({
  getGame: (id: string) => ({ id, name: id }),
}));
vi.mock("../../nexus_integration/util", () => ({
  nexusGames: () => [{ domain_name: "skyrimspecialedition", id: 1704 }],
}));
vi.mock("../../nexus_integration/util/convertGameId", () => ({
  nexusGameId: (_game: unknown, id: string) =>
    id === "skyrimse" ? "skyrimspecialedition" : "unknown-domain",
}));

describe("numericNexusGameId", () => {
  it("resolves an internal game id to its numeric Nexus id", () => {
    expect(numericNexusGameId("skyrimse")).toBe(1704);
  });

  it("returns null when the game isn't in the Nexus games cache", () => {
    expect(numericNexusGameId("somethingelse")).toBeNull();
  });
});
