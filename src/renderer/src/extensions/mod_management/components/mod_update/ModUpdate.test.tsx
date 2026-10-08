import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMod } from "../../types/IMod";

const api = vi.hoisted(() => ({ events: { emit: vi.fn() }, getState: vi.fn() }));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "stardewvalley" }));
// Nexus Mods identifies each file, so an installed mod from it needs its file id.
vi.mock("../../util/modSource", () => ({
  getModSource: (id: string) =>
    id === "nexus" ? { id, options: { supportsModId: true } } : { id, options: {} },
}));

import { ModUpdate, modUpdateShows } from "./ModUpdate";

const mod = (attributes: object, state = "installed") =>
  ({
    id: "a",
    type: "",
    state,
    attributes: { source: "nexus", modId: 12, fileId: 100, version: "1.0", ...attributes },
  }) as unknown as IMod;

describe("ModUpdate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says whether it shows anything, for the version beside it", () => {
    expect(modUpdateShows(mod({ newestVersion: "1.0" }))).toBe(false);
    expect(modUpdateShows(mod({ newestVersion: "1.1", newestFileId: 101 }))).toBe(true);
    expect(modUpdateShows(mod({ source: undefined }))).toBe(true);
  });

  it("says nothing while the mod is up to date", () => {
    const { container } = render(<ModUpdate mod={mod({ newestVersion: "1.0" })} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("updates to the newest file from its button", async () => {
    render(<ModUpdate mod={mod({ newestVersion: "1.1", newestFileId: 101 })} />);

    // the test `t` leaves the version uninterpolated
    await userEvent.click(
      screen.getByRole("button", { name: "Mod can be updated (Current version: {{newVersion}})" }),
    );

    expect(api.events.emit).toHaveBeenCalledWith("mod-update", "stardewvalley", 12, 101, "nexus");
  });

  it("opens the mod's page to pick the file when the newest can't be told", async () => {
    render(<ModUpdate mod={mod({ newestVersion: "1.1", newestFileId: "unknown" })} />);

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mod can be updated (but you will have to pick the file yourself)",
      }),
    );

    expect(api.events.emit).toHaveBeenCalledWith("open-mod-page", "stardewvalley", 12, "nexus");
  });

  it("opens the newest version's changelog while there's an update", async () => {
    render(
      <ModUpdate
        mod={mod({
          newestVersion: "1.1",
          newestFileId: 101,
          newestChangelog: { format: "html", content: "<p>Fixed <b>things</b></p>" },
        })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "View changelog" }));

    expect(screen.getByText("things").tagName).toBe("B");
  });

  it("leaves out a changelog left behind once the mod is up to date", () => {
    render(
      <ModUpdate
        mod={mod({ newestVersion: "1.0", newestChangelog: { format: "text", content: "Old" } })}
      />,
    );

    expect(screen.queryByRole("button", { name: "View changelog" })).toBeNull();
  });

  it("warns that a mod with no source can't be checked", () => {
    render(<ModUpdate mod={mod({ source: undefined })} />);

    expect(
      screen.getByRole("img", { name: /This mod has no source assigned/ }),
    ).toBeInTheDocument();
  });

  it("warns without a button, as there's nothing to do", () => {
    render(<ModUpdate mod={mod({ source: undefined })} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("warns that a Nexus Mods mod without its file id can't be identified", () => {
    render(<ModUpdate mod={mod({ fileId: undefined })} />);

    expect(
      screen.getByRole("img", { name: /This mod is missing identification information/ }),
    ).toBeInTheDocument();
  });
});
