import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fills in `{{…}}`, which the shared stub leaves alone, so the text reads as it's shown.
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTranslation: () => {
    const t = (key: string, options?: Record<string, string | number>) =>
      key.replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ""));
    return Object.assign([t, undefined, true], { t, i18n: undefined, ready: true });
  },
}));

import {
  ExternalImagePlaceholder,
  type IExternalImage,
  type IExternalImagePlaceholderOptions,
} from "./ExternalImagePlaceholder";

const openUrl = vi.fn();

const renderPlaceholder = (
  images: IExternalImage[],
  props: Partial<IExternalImagePlaceholderOptions> = {},
) => {
  const all = { websiteUrl: "https://www.nexusmods.com/skyrimspecialedition/mods/1", ...props };
  render(<ExternalImagePlaceholder images={images} {...all} />);
  return all;
};

describe("ExternalImagePlaceholder", () => {
  beforeEach(() => {
    openUrl.mockReset();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
  });

  it("names a lone image by its alt text, and where it's from", () => {
    renderPlaceholder([{ host: "i.imgur.com", alt: "Lanterns of the North banner" }]);

    expect(screen.getByText("“Lanterns of the North banner”")).toBeInTheDocument();
    expect(
      screen.getByText("External image from i.imgur.com · not shown in Vortex"),
    ).toBeInTheDocument();
  });

  it("calls a lone image without alt text an external image", () => {
    renderPlaceholder([{ host: "i.imgur.com" }]);

    expect(screen.getByText("External image")).toBeInTheDocument();
    expect(screen.getByText("From i.imgur.com · not shown in Vortex")).toBeInTheDocument();
  });

  it("counts a run of images, naming up to three hosts and how many more", () => {
    renderPlaceholder([
      { host: "i.imgur.com", alt: "Ignored in a run" },
      { host: "imgsli.com" },
      { host: "i.postimg.cc" },
      { host: "i.imgur.com" },
      { host: "cdn.discordapp.com" },
    ]);

    expect(screen.getByText("5 external images")).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
    expect(
      screen.getByText("From i.imgur.com, imgsli.com, i.postimg.cc, +1 more · not shown in Vortex"),
    ).toBeInTheDocument();
  });

  it("names a linked image by its alt text, and labels its link with it", () => {
    renderPlaceholder([
      { host: "i.imgur.com", alt: "Join our Discord", href: "https://discord.gg/abc" },
    ]);

    expect(screen.getByText("Linked image “Join our Discord”")).toBeInTheDocument();
    expect(screen.getByText("Links to")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join our Discord" })).toBeInTheDocument();
  });

  it("labels a link without alt text by its domain, with the whole link on hover", async () => {
    renderPlaceholder([{ host: "i.imgur.com", href: "https://www.patreon.com/someone" }]);

    expect(screen.getByText("Linked external image")).toBeInTheDocument();

    await userEvent.hover(screen.getByRole("button", { name: "patreon.com" }));

    expect(await screen.findByText("https://www.patreon.com/someone")).toBeInTheDocument();
  });

  it("lists every link of a run of linked images", () => {
    renderPlaceholder([
      { host: "i.imgur.com", href: "https://discord.gg/abc" },
      { host: "imgsli.com", href: "https://patreon.com/x" },
    ]);

    expect(screen.getByText("2 external images with links")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "discord.gg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "patreon.com" })).toBeInTheDocument();
  });

  it("leaves out links that aren't web pages", () => {
    renderPlaceholder([{ host: "i.imgur.com", href: "file:///etc/passwd" }]);

    expect(screen.getByText("External image")).toBeInTheDocument();
    expect(screen.queryByText("Links to")).not.toBeInTheDocument();
  });

  it("opens an image's link, telling its domain", async () => {
    const props = renderPlaceholder([{ host: "i.imgur.com", href: "https://discord.gg/abc" }], {
      onLinkOpened: vi.fn(),
    });

    await userEvent.click(screen.getByRole("button", { name: "discord.gg" }));

    expect(openUrl).toHaveBeenCalledWith("https://discord.gg/abc");
    expect(props.onLinkOpened).toHaveBeenCalledWith("discord.gg");
  });

  it("opens the website, telling how many images it stood for", async () => {
    const props = renderPlaceholder([{ host: "i.imgur.com" }, { host: "imgsli.com" }], {
      onViewWebsite: vi.fn(),
    });

    await userEvent.click(screen.getByRole("button", { name: "View on website" }));

    expect(openUrl).toHaveBeenCalledWith("https://www.nexusmods.com/skyrimspecialedition/mods/1");
    expect(props.onViewWebsite).toHaveBeenCalledWith("placeholder", 2);
  });

  it("explains why in a dialog, which opens the website too", async () => {
    const props = renderPlaceholder([{ host: "i.imgur.com" }], {
      onWhyOpened: vi.fn(),
      onViewWebsite: vi.fn(),
    });

    await userEvent.click(screen.getByRole("button", { name: "Why?" }));

    expect(props.onWhyOpened).toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Why isn't this image shown?");
    expect(dialog).toHaveTextContent("Vortex only loads images stored on Nexus Mods.");

    await userEvent.click(screen.getByRole("button", { name: "View on website", hidden: false }));

    expect(props.onViewWebsite).toHaveBeenCalledWith("dialog", 1);
  });
});
