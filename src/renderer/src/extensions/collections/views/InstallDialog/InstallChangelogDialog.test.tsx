import type { IRevision } from "@nexusmods/nexus-api";
import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IMod } from "@/extensions/mod_management/types/IMod";

import showChangelog, { InstallChangelogDialog } from "./InstallChangelogDialog";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: () => undefined,
}));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));
vi.mock("@/controls/Icon", () => ({ default: () => null }));
// Draws the collection's own tile image; only the changelog's images are under test.
vi.mock("../CollectionTile", () => ({ default: () => null }));

const nexusImage = "https://staticdelivery.nexusmods.com/images/1704/a.png";
const externalImage = "https://i.imgur.com/b.png";

const collection = { id: "collection", attributes: { name: "Lanterns" } } as unknown as IMod;

const revision = (description: string) =>
  ({
    revisionNumber: 2,
    collection: { slug: "lanterns", game: { domainName: "skyrimspecialedition" } },
    collectionChangelog: { createdAt: "2026-11-01T00:00:00Z", description },
  }) as unknown as IRevision;

// Every image in the dialog, whatever role it's given.
const imageSources = () =>
  Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"));

describe("InstallChangelogDialog", () => {
  it("shows only Nexus Mods images in the changelog", async () => {
    render(<InstallChangelogDialog />);

    act(() => {
      void showChangelog(
        collection,
        "skyrimse",
        revision(`Look ![a](${nexusImage}) and ![b](${externalImage})`),
      );
    });

    await waitFor(() => expect(imageSources()).toContain(nexusImage));
    expect(imageSources()).toEqual([nexusImage]);
  });
});
