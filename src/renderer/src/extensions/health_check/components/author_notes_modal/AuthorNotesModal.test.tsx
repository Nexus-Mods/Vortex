import { EventEmitter } from "events";

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { settleTransitions } from "@/test-utils/transitions";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { MixpanelEvent } from "../../../analytics/mixpanel/MixpanelEvents";
import { HealthCheckTrackingProvider } from "../../hooks/HealthCheckTracking.context";
import type { IBulkInstallItem } from "../../views/content/types";
import { AuthorNotesModal } from "./AuthorNotesModal";

const noted = (key: string, modId: number): IBulkInstallItem => ({
  key,
  install: vi.fn(),
  requiredFor: ["Source"],
  notedRequirement: { modId, modName: `Mod ${key}`, note: "Optional" },
});

const items: IBulkInstallItem[] = [
  { key: "plain", install: vi.fn() },
  noted("a", 1),
  noted("b", 2),
];

function renderModal() {
  const emitter = new EventEmitter();
  const events: MixpanelEvent[] = [];
  emitter.on("analytics-track-mixpanel-event", (e: MixpanelEvent) => events.push(e));
  const api = { events: emitter } as unknown as IExtensionApi;
  const onClose = vi.fn();
  const onInstall = vi.fn();

  render(
    <HealthCheckTrackingProvider api={api}>
      <AuthorNotesModal isOpen items={items} onClose={onClose} onInstall={onInstall} />
    </HealthCheckTrackingProvider>,
  );

  return { events, onClose, onInstall };
}

describe("AuthorNotesModal", () => {
  it("lists only the noted mods, all checked, and reports being shown", async () => {
    const { events } = renderModal();

    const boxes = screen.getAllByTestId("health-check-author-note-checkbox");
    expect(boxes).toHaveLength(2);
    boxes.forEach((box) => expect(box).toBeChecked());
    expect(events.map((e) => e.eventName)).toEqual(["health_check_author_notes_modal_shown"]);
    expect(events[0].properties).toEqual({ mod_count: 2 });

    await settleTransitions();
  });

  it("counts everything the install will install, the unnoted mods included", async () => {
    const { events, onInstall } = renderModal();

    fireEvent.click(screen.getByTestId("health-check-author-notes-install"));

    expect(onInstall.mock.calls[0][0]).toHaveLength(3);
    expect(events.at(-1)?.properties).toMatchObject({ selected_count: 3, noted_checked_count: 2 });

    await settleTransitions();
  });

  it("installs the unnoted mods and the noted ones left checked", async () => {
    const { events, onInstall } = renderModal();

    fireEvent.click(screen.getAllByTestId("health-check-author-note-checkbox")[0]);
    fireEvent.click(screen.getByTestId("health-check-author-notes-install"));

    expect(onInstall.mock.calls[0][0].map((i: IBulkInstallItem) => i.key)).toEqual(["plain", "b"]);
    expect(events.slice(1)).toEqual([
      {
        eventName: "health_check_author_notes_mod_toggled",
        properties: { mod_id: 1, checked: false },
      },
      {
        eventName: "health_check_author_notes_install_selected_clicked",
        properties: { selected_count: 2, noted_checked_count: 1, mod_count: 2 },
      },
    ]);

    await settleTransitions();
  });

  it("tells Cancel apart from closing", async () => {
    const { events, onClose } = renderModal();

    fireEvent.click(screen.getByTestId("health-check-author-notes-cancel"));
    fireEvent.click(document.querySelector(".nxm-modal-close")!);

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(events.slice(1).map((e) => e.eventName)).toEqual([
      "health_check_author_notes_cancel_clicked",
      "health_check_author_notes_closed",
    ]);

    await settleTransitions();
  });
});
