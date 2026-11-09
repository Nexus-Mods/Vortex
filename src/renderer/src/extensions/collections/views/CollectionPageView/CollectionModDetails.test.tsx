import type { ICollectionRevisionMod } from "@nexusmods/nexus-api";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { TFunction } from "../../../../util/i18n";
import CollectionModDetails from "./CollectionModDetails";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));
vi.mock("../../../../controls/Icon", () => ({ default: () => null }));

const nexusImage = "https://staticdelivery.nexusmods.com/mods/1704/images/a.png";
const externalImage = "https://i.imgur.com/b.png";

const t = ((text: string) => text) as TFunction;

const remoteMod = (summary: string, modId?: number) =>
  ({
    file: {
      modId,
      game: { domainName: "skyrimspecialedition" },
      mod: { name: "Lanterns", summary },
    },
  }) as unknown as ICollectionRevisionMod;

// Every image in the details, whatever role it's given.
const imageSources = () =>
  Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"));

describe("CollectionModDetails", () => {
  it("shows Nexus Mods images in the description, and a placeholder for others", () => {
    render(
      <CollectionModDetails
        gameId="skyrimse"
        remote={remoteMod(`Look [img]${nexusImage}[/img] and [img]${externalImage}[/img]`, 42)}
        t={t}
      />,
    );

    expect(imageSources()).not.toContain(externalImage);
    expect(imageSources()).toContain(nexusImage);
    expect(screen.getByText("External image")).toBeInTheDocument();
  });

  it("leaves out other images for a mod with no page on Nexus Mods", () => {
    render(
      <CollectionModDetails
        gameId="skyrimse"
        remote={remoteMod(`Look [img]${externalImage}[/img]`)}
        t={t}
      />,
    );

    expect(imageSources()).not.toContain(externalImage);
    expect(screen.queryByText("External image")).not.toBeInTheDocument();
  });
});
