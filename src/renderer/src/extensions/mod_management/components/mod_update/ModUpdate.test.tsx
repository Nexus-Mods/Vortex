import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMod } from "../../types/IMod";

const api = vi.hoisted(() => ({
  events: { emit: vi.fn() },
  getState: vi.fn(() => ({ persistent: { mods: {} } })),
}));
// the warning confirms the update unless a test says the user cancelled it
const confirm = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));
vi.mock("../../util/collection_update_warning/collectionUpdateWarning", () => ({
  confirmCollectionModUpdate: confirm,
}));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "stardewvalley" }));
// Nexus Mods identifies each file, so an installed mod from it needs its file id.
vi.mock("../../util/modSource", () => ({
  getModSource: (id: string) =>
    id === "nexus" ? { id, options: { supportsModId: true } } : { id, options: {} },
}));

import { ModUpdate, modUpdateDetails } from "./ModUpdate";

const mod = (attributes: object, state = "installed", id = "b") =>
  ({
    id,
    type: "",
    state,
    attributes: { source: "nexus", modId: 12, fileId: 100, version: "1.0", ...attributes },
  }) as unknown as IMod;

describe("ModUpdate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says whether it shows anything, for the version beside it", () => {
    const shows = (attributes: object) => modUpdateDetails(mod(attributes)).shows;

    expect(shows({ newestVersion: "1.0" })).toBe(false);
    expect(shows({ newestVersion: "1.1", newestFileId: 101 })).toBe(true);
    expect(shows({ source: undefined })).toBe(true);
  });

  it("says nothing while the mod is up to date", () => {
    const { container } = render(<ModUpdate mod={mod({ newestVersion: "1.0" })} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("updates to the newest file from its button", async () => {
    render(<ModUpdate mod={mod({ newestVersion: "1.1", newestFileId: 101 })} />);

    // the test `t` leaves the version uninterpolated
    await userEvent.click(screen.getByRole("button", { name: "Update to {{version}}" }));

    expect(api.events.emit).toHaveBeenCalledWith("mod-update", "stardewvalley", 12, 101, "nexus");
  });

  it("updates only once the collection warning is confirmed", async () => {
    confirm.mockResolvedValueOnce(false);
    render(<ModUpdate mod={mod({ newestVersion: "1.1", newestFileId: 101 })} />);
    const button = screen.getByRole("button", { name: "Update to {{version}}" });

    await userEvent.click(button);
    expect(confirm).toHaveBeenCalledWith(api, "stardewvalley", "b");
    expect(api.events.emit).not.toHaveBeenCalled();

    await userEvent.click(button);
    expect(api.events.emit).toHaveBeenCalledWith("mod-update", "stardewvalley", 12, 101, "nexus");
  });

  it("groups only what it offers an update for, not a bugged version without one", () => {
    expect(modUpdateDetails(mod({ newestVersion: "1.1", newestFileId: 101 })).hasUpdate).toBe(true);
    expect(modUpdateDetails(mod({ newestVersion: "1.1", newestFileId: "unknown" })).hasUpdate).toBe(
      true,
    );
    expect(modUpdateDetails(mod({ newestVersion: "1.0", bugMessage: "Broken" })).hasUpdate).toBe(
      false,
    );
  });

  it("opens the mod's page to pick the file when the newest can't be told", async () => {
    render(<ModUpdate mod={mod({ newestVersion: "1.1", newestFileId: "unknown" })} />);

    await userEvent.click(screen.getByRole("button", { name: "Choose update file" }));

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

    expect(screen.getByText("Changelog")).toBeInTheDocument();
    expect(screen.getByText("Newest Version")).toBeInTheDocument();
    expect(screen.getByText("things").tagName).toBe("B");
  });

  it("shows a plain-text changelog as it's written, not as markdown", async () => {
    render(
      <ModUpdate
        mod={mod({
          newestVersion: "1.1",
          newestFileId: 101,
          newestChangelog: { format: "text", content: "# Fixed *things*\nAdded more" },
        })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "View changelog" }));

    expect(screen.getByText(/# Fixed \*things\*\s+Added more/)).toHaveClass("whitespace-pre-line");
    expect(screen.queryByRole("heading")).toBeNull();
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

    expect(screen.getByRole("img", { name: "Mod source unknown" })).toHaveAttribute(
      "aria-description",
      "Vortex doesn't know where this mod came from, so it can't check for updates.",
    );
  });

  it("warns without a button, as there's nothing to do", () => {
    render(<ModUpdate mod={mod({ source: undefined })} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("warns that a Nexus Mods mod without its file id can't be identified", () => {
    render(<ModUpdate mod={mod({ fileId: undefined })} />);

    expect(screen.getByRole("img", { name: "Mod not identified" })).toBeInTheDocument();
  });
});
