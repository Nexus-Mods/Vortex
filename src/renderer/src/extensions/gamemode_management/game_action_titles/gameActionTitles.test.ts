/**
 * Game actions register their titles untranslated. Every renderer translates the title
 * itself, and the Games page reports it as the action's analytics key, which a title
 * translated at registration would split across languages.
 */
import { describe, expect, it, vi } from "vitest";

// Loading the extensions reads app paths at module scope; none of it matters here.
vi.mock("../../../util/getVortexPath", () => ({ default: () => "" }));

import type { IExtensionContext } from "../../../types/IExtensionContext";
import nexusIntegration from "../../nexus_integration/index";
import profileManagement from "../../profile_management/index";
import gamemodeManagement from "../index";

/** A context that records registerAction and absorbs every other call. */
const recordingContext = () => {
  const registered: Array<{ group: string; title: unknown }> = [];
  const absorb: any = new Proxy(() => absorb, { get: () => absorb, apply: () => absorb });
  const api = new Proxy(
    { translate: (input: string) => `translated:${input}` },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : absorb) },
  );
  const context = new Proxy({} as IExtensionContext, {
    get: (_target, key) => {
      if (key === "api") {
        return api;
      }
      if (key === "registerAction") {
        return (
          group: string,
          _position: number,
          _icon: unknown,
          _options: unknown,
          title: unknown,
        ) => registered.push({ group, title });
      }
      return absorb;
    },
  });
  return { context, registered };
};

describe.each([
  ["gamemode_management", gamemodeManagement],
  ["profile_management", profileManagement],
  ["nexus_integration", nexusIntegration],
])("%s", (_name, init) => {
  it("registers its game actions with untranslated titles", () => {
    const { context, registered } = recordingContext();

    init(context);

    const titles = registered
      .filter(({ group }) => /^game-.*-buttons$/.test(group))
      .map(({ title }) => title)
      .filter((title): title is string => typeof title === "string");
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.filter((title) => title.startsWith("translated:"))).toEqual([]);
  });
});
