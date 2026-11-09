import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NEXUS_BASE_URL } from "../../../nexus_integration/constants";
import { ExtensionDescription } from "./ExtensionDescription";

// The user's adult content setting is unknown, so adult images blur, as they do logged out.
vi.mock("react-redux", () => ({ useSelector: () => undefined }));
vi.mock("@/extensions/nexus_integration/selectors", () => ({ userInfo: () => undefined }));
vi.mock("../../../../controls/Icon", () => ({ default: () => null }));
vi.mock("../../../../controls/Spinner", () => ({ default: () => <span>Loading</span> }));

const nexusImage = "https://staticdelivery.nexusmods.com/mods/2295/images/a.png";
const externalImage = "https://i.imgur.com/b.png";

const openUrl = vi.fn();

// Every image in the description, whatever role it's given.
const imageSources = () =>
  Array.from(document.querySelectorAll("img"), (img) => img.getAttribute("src"));

describe("ExtensionDescription", () => {
  beforeEach(() => {
    openUrl.mockReset();
    vi.stubGlobal("api", { ...window.api, shell: { openUrl } });
  });

  it("shows Nexus Mods images, and a placeholder pointing to the extension's page for others", async () => {
    render(
      <ExtensionDescription
        description={`Look [img]${nexusImage}[/img] and [img]${externalImage}[/img]`}
        modId={1234}
      />,
    );

    expect(imageSources()).not.toContain(externalImage);
    expect(imageSources()).toContain(nexusImage);

    await userEvent.click(screen.getByRole("button", { name: "View on website" }));
    expect(openUrl).toHaveBeenCalledWith(`${NEXUS_BASE_URL}/site/mods/1234`);
  });

  it("shows a spinner while the description is being fetched", () => {
    render(<ExtensionDescription description={undefined} modId={1234} />);

    expect(screen.getByText("Loading")).toBeInTheDocument();
  });
});
