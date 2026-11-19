import { renderHook } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useMainContext: () => ({ api: { events: { emit: vi.fn() } } }),
}));

import { NEXUS_BASE_URL } from "@/extensions/nexus_integration/constants";
import { makeModsTableStore } from "@/test-utils/modsTableStore";
import type { ITableAttribute } from "@/types/ITableAttribute";
import type { TFunction } from "@/util/i18n";

import type { IMod } from "../../types/IMod";
import type { IModWithState } from "../../types/IModProps";
import { RegisteredValues } from "../../util/registered_values/registeredValues";
import { type IModProperties, useModProperties } from "./useModProperties.hook";

const HOUR = 60 * 60 * 1000;

const mod = (id: string, fields: object = {}) =>
  ({ id, type: "", state: "installed", attributes: {}, ...fields }) as unknown as IModWithState;

const SKYUI = mod("skyui", {
  archiveId: "archive",
  enabledTime: Date.now() - HOUR,
  attributes: {
    name: "SkyUI",
    shortDescription: "A friendlier menu.",
    description: "[b]SkyUI[/b] is an interface mod.",
    author: "schlangster",
    pictureUrl: "https://example.com/skyui.png",
    adultContent: false,
    version: "5.2",
    installTime: Date.now() - 2 * HOUR,
    source: "nexus",
    modId: 12604,
    fileId: 35407,
    variant: "Lite",
  },
});

const KNOWN = [
  { id: "game", name: "Test Game", nexus: { gameDomain: "testgame" } },
  { id: "skyrimse", name: "Skyrim Special Edition", nexus: { gameDomain: "skyrimspecialedition" } },
];

const collection = (name: string) => ({ id: name, attributes: { name } }) as unknown as IMod;

const t = ((key: string) => key) as unknown as TFunction;

const renderProperties = (
  mods: IModWithState[],
  memberships: { [modId: string]: IMod[] } = {},
  attributes: ITableAttribute[] = [],
): IModProperties => {
  const store = makeModsTableStore({
    knownGames: KNOWN,
    downloads: {
      archive: { localPath: "SkyUI_5_2_SE-12604-5-2SE.7z", fileTime: Date.now() - HOUR },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const registered = { attributes, detailsOnly: attributes, values: new RegisteredValues(t) };
  return renderHook(() => useModProperties(mods, memberships, registered), { wrapper }).result
    .current;
};

/** Every property, with the tab it's on. */
const properties = (result: IModProperties) =>
  result.sections.flatMap((section) =>
    section.properties.map((property) => ({ ...property, tab: section.tab })),
  );

const propertyById = (result: IModProperties, id: string) =>
  properties(result).find((property) => property.id === id);

describe("useModProperties", () => {
  it("builds the card for one mod", () => {
    expect(renderProperties([SKYUI]).card).toEqual({
      name: "SkyUI",
      summary: "A friendlier menu.",
      description: "[b]SkyUI[/b] is an interface mod.",
      author: "schlangster",
      pictureUrl: "https://example.com/skyui.png",
      pageUrl: `${NEXUS_BASE_URL}/testgame/mods/12604`,
      isAdult: false,
      status: undefined,
    });
  });

  // As its game section keeps it, which can differ from the active game.
  it("links the card to the mod's page in its game section", () => {
    const fromSkyrimSE = mod("skyui", {
      attributes: { ...SKYUI.attributes, downloadGame: "skyrimse" },
    });

    expect(renderProperties([fromSkyrimSE]).card?.pageUrl).toBe(
      `${NEXUS_BASE_URL}/skyrimspecialedition/mods/12604`,
    );
  });

  it("has no page for a mod that isn't from Nexus Mods", () => {
    const local = mod("local", { attributes: { name: "Local", source: "other", modId: 1 } });

    expect(renderProperties([local]).card?.pageUrl).toBeUndefined();
  });

  it("tags a downloaded mod's card", () => {
    expect(renderProperties([mod("a", { state: "downloaded" })]).card?.status).toBe("downloaded");
  });

  it("puts its version and times side by side on General", () => {
    const result = renderProperties([SKYUI]);
    const times = result.sections.find((section) => section.id === "times");

    expect(times?.tab).toBe("general");
    expect(times?.layout).toBe("grid");
    expect(times?.properties.map(({ id }) => id)).toEqual([
      "version",
      "installTime",
      "downloadTime",
      "enabledTime",
    ]);
    expect(propertyById(result, "version")).toMatchObject({ value: "5.2" });
  });

  // As a mod that's never been enabled keeps it, which would otherwise read as 1970.
  it("leaves out a time of zero", () => {
    const neverEnabled = mod("skyui", { ...SKYUI, enabledTime: 0 });

    expect(propertyById(renderProperties([neverEnabled]), "enabledTime")).toBeUndefined();
  });

  it("lists a Nexus mod's ID on General, to copy", () => {
    expect(propertyById(renderProperties([SKYUI]), "nexusModId")).toMatchObject({
      tab: "general",
      value: "12604",
      copyable: true,
    });
  });

  it("lists a Nexus collection's collection ID, to copy, rather than a mod ID", () => {
    const result = renderProperties([
      mod("lorerim", {
        type: "collection",
        attributes: { source: "nexus", modId: 1, collectionId: 4242 },
      }),
    ]);

    expect(propertyById(result, "nexusModId")).toBeUndefined();
    expect(propertyById(result, "nexusCollectionId")).toMatchObject({
      tab: "general",
      value: "4242",
      copyable: true,
    });
  });

  it("says a Nexus collection with no collection ID isn't published", () => {
    const result = renderProperties([
      mod("draft", { type: "collection", attributes: { source: "nexus" } }),
    ]);

    expect(propertyById(result, "nexusCollectionId")).toMatchObject({
      value: "modsTable::properties::notPublished",
      copyable: false,
    });
  });

  it("lists the collections it's in, by name", () => {
    const result = renderProperties([SKYUI], {
      skyui: [collection("Lorerim"), collection("Gate to Sovngarde")],
    });

    expect(propertyById(result, "collections")).toMatchObject({
      value: "Gate to Sovngarde, Lorerim",
    });
  });

  it("lists its archive, variant and file ID on Advanced", () => {
    const result = renderProperties([SKYUI]);

    expect(propertyById(result, "archiveName")).toMatchObject({
      tab: "advanced",
      value: "SkyUI_5_2_SE-12604-5-2SE.7z",
    });
    expect(propertyById(result, "variant")).toMatchObject({ tab: "advanced", value: "Lite" });
    expect(propertyById(result, "nexusFileId")).toMatchObject({
      tab: "advanced",
      value: "35407",
      copyable: true,
    });
  });

  it("hides read-only fields with no value, and a section with none", () => {
    const result = renderProperties([mod("bare", { attributes: { name: "Bare" } })]);

    expect(properties(result).filter(({ kind }) => kind === "value")).toEqual([]);
    expect(result.sections.map(({ id }) => id)).toEqual(["organise", "type", "source"]);
  });

  it("has no Nexus IDs for a mod from elsewhere", () => {
    const result = renderProperties([
      mod("manual", { attributes: { source: "website", modId: 1, fileId: 2 } }),
    ]);

    expect(propertyById(result, "nexusModId")).toBeUndefined();
    expect(propertyById(result, "nexusFileId")).toBeUndefined();
  });

  it("counts several mods, with no card and only what they can all change", () => {
    const result = renderProperties([SKYUI, mod("b"), mod("c")]);

    expect(result.count).toBe(3);
    expect(result.card).toBeUndefined();
    expect(properties(result).map(({ id }) => id)).toEqual([
      "category",
      "notes",
      "modType",
      "source",
    ]);
  });

  it("lists the installer's choices on Advanced, a group's on one line", () => {
    const result = renderProperties([
      mod("fomod", {
        attributes: {
          installerChoices: {
            type: "fomod",
            options: [
              {
                name: "Main",
                groups: [
                  { name: "Textures", choices: [{ name: "2K", idx: 0 }] },
                  {
                    name: "Patches",
                    choices: [
                      { name: "USSEP", idx: 0 },
                      { name: "AE", idx: 1 },
                    ],
                  },
                  { name: "Skipped", choices: [] },
                ],
              },
            ],
          },
        },
      }),
    ]);

    const installer = result.sections.find(({ id }) => id === "installer");
    expect(installer?.tab).toBe("advanced");
    expect(installer?.properties).toMatchObject([
      { kind: "value", label: "Textures", value: "2K" },
      { kind: "value", label: "Patches", value: "USSEP, AE" },
    ]);
  });

  it("lists installer choices kept as an object", () => {
    const result = renderProperties([
      mod("fomod", {
        attributes: {
          installerChoices: {
            type: "fomod",
            options: {
              0: { name: "Main", groups: [{ name: "Textures", choices: [{ name: "2K" }] }] },
            },
          },
        },
      }),
    ]);

    const installer = result.sections.find(({ id }) => id === "installer");
    expect(installer?.properties).toMatchObject([
      { kind: "value", label: "Textures", value: "2K" },
    ]);
  });

  it("skips a group with no choices list", () => {
    const result = renderProperties([
      mod("fomod", {
        attributes: {
          installerChoices: {
            type: "fomod",
            options: [
              {
                name: "Main",
                groups: [{ name: "Broken" }, { name: "Textures", choices: [{ name: "2K" }] }],
              },
            ],
          },
        },
      }),
    ]);

    const installer = result.sections.find(({ id }) => id === "installer");
    expect(installer?.properties).toMatchObject([
      { kind: "value", label: "Textures", value: "2K" },
    ]);
  });

  it("puts the category and notes under the card, and the source on Advanced", () => {
    const result = renderProperties([SKYUI]);

    expect(result.sections.map(({ id, tab }) => `${tab}:${id}`)).toEqual([
      "general:organise",
      "general:times",
      "general:links",
      "advanced:type",
      "advanced:source",
      "advanced:files",
    ]);
    expect(result.sections[2].properties.map(({ id }) => id)).toEqual(["nexusModId"]);
    expect(result.sections[4].properties.map(({ id }) => id)).toEqual(["source"]);
  });

  describe("what extensions registered for the legacy details pane", () => {
    const attribute = (id: string, fields: Partial<ITableAttribute> = {}) =>
      ({ id, name: id, placement: "detail", calc: () => "value", ...fields }) as ITableAttribute;

    it("ends Advanced with those the panel doesn't show as its own, in order", () => {
      const result = renderProperties([SKYUI], {}, [
        attribute("checksum"),
        attribute("installer"),
        attribute("notes"),
        attribute("drawn", { calc: undefined, customRenderer: () => null }),
      ]);

      const registered = result.sections.find(({ id }) => id === "registered");
      expect(registered?.tab).toBe("advanced");
      expect(result.sections.at(-1)).toBe(registered);
      expect(registered?.properties).toMatchObject([
        { kind: "registered", id: "registered:checksum", attribute: { id: "checksum" } },
        { kind: "registered", id: "registered:drawn", attribute: { id: "drawn" } },
      ]);
    });

    it("leaves out one with nothing to draw", () => {
      expect(
        propertyById(
          renderProperties([SKYUI], {}, [attribute("empty", { calc: undefined })]),
          "registered:empty",
        ),
      ).toBeUndefined();
    });

    it("shows several mods only those that take several, for them all", () => {
      const mods = [SKYUI, mod("other")];
      const result = renderProperties(mods, {}, [
        attribute("checksum"),
        attribute("version", { supportsMultiple: true }),
      ]);

      expect(propertyById(result, "registered:checksum")).toBeUndefined();
      expect(propertyById(result, "registered:version")).toMatchObject({
        kind: "registered",
        mods,
      });
    });

    it("is labelled by its name, translated", () => {
      const result = renderProperties([SKYUI], {}, [attribute("checksum", { name: "Checksum" })]);

      expect(propertyById(result, "registered:checksum")?.label).toBe("Checksum");
    });
  });
});
