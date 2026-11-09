import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { TFunction } from "@/util/i18n";

import Description from "./Description";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));
vi.mock("@/controls/Icon", () => ({ default: () => null }));

const nexusImage = "https://staticdelivery.nexusmods.com/mods/1704/images/a.png";
const externalImage = "https://i.imgur.com/b.png";

const t = ((text: string) => text) as TFunction;

const renderDescription = (props: { short?: string; long?: string }) =>
  render(
    <Description
      installed
      long={props.long ?? ""}
      modId="mod"
      short={props.short ?? "Short"}
      source="nexus"
      startEditDescription={vi.fn()}
      t={t}
    />,
  );

// Every image on the page, popover included, whatever role it's given.
const imageSources = () =>
  Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"));

describe("Description", () => {
  it("shows only Nexus Mods images in the long description", async () => {
    renderDescription({
      long: `Look [img]${nexusImage}[/img] and [img]${externalImage}[/img]`,
    });

    await userEvent.click(screen.getByTestId("mod-description-toggle"));

    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    expect(imageSources()).toEqual([nexusImage]);
  });

  it("shows only Nexus Mods images in the short description", () => {
    renderDescription({
      short: `Short [img]${nexusImage}[/img] and [img]${externalImage}[/img]`,
    });

    expect(imageSources()).toEqual([nexusImage]);
  });
});
