import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { i18n } from "i18next";
import React from "react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createTestI18n } from "@/test-utils/i18n";
import { settleTransitions } from "@/test-utils/transitions";

import type {
  IMissingRequirement,
  IRequirementLink,
} from "../../utils/requirementLinks/requirementLinks";
import { type IRequirementLinksModalProps, RequirementLinksModal } from "./RequirementLinksModal";

// the real react-i18next in place of the setup's stub, as the text checked is the user's
vi.mock("react-i18next", async (importOriginal) => importOriginal());

let translation: i18n;

beforeAll(async () => {
  translation = await createTestI18n("health_check");
});

const link = (
  sourceName: string,
  targetName: string,
  extra: Partial<IRequirementLink> = {},
): IRequirementLink => ({
  key: `${sourceName}:${targetName}`,
  sourceModId: sourceName,
  sourceName,
  targetModId: targetName,
  targetName,
  targetUid: `uid-${targetName}`,
  ...extra,
});

// one requirement new, the rest saved as each choice, one of them installed in the wrong version
const newLink = link("Native Settings", "CET");
const optionalLink = link("Native Settings", "RED4ext", { current: "recommends" });
const ignoredLink = link("Scannable Stash", "ArchiveXL", { current: "ignore" });
const wrongVersionLink = link("Scannable Stash", "DQC", {
  current: "requires",
  wrongVersion: {
    installed: "3.1.5",
    wanted: { versions: { oldest: "3.2.0", newest: "3.3.3" } },
    differentFile: false,
  },
});
const links = [newLink, optionalLink, ignoredLink, wrongVersionLink];

const notInstalled: IMissingRequirement = {
  key: "Scannable Stash:Codeware",
  sourceModId: "Scannable Stash",
  sourceName: "Scannable Stash",
  options: [{ modName: "Codeware" }],
};

function renderModal(props: Partial<IRequirementLinksModalProps> = {}) {
  const onAnswer = vi.fn();
  const onHide = vi.fn();

  render(
    <I18nextProvider i18n={translation}>
      <RequirementLinksModal
        visible
        links={links}
        missing={[notInstalled]}
        onAnswer={onAnswer}
        onHide={onHide}
        {...props}
      />
    </I18nextProvider>,
  );

  return { onAnswer, onHide };
}

/** The row of the requirement on the named mod. */
const rowOf = (targetName: string) =>
  screen.getByRole("radiogroup", { name: targetName }).closest("li") as HTMLElement;

const choose = (targetName: string, choice: string) =>
  userEvent.click(within(rowOf(targetName)).getByRole("radio", { name: choice }));

const markOf = (targetName: string) =>
  within(rowOf(targetName)).queryByTestId("requirement-change-mark");

const saveButton = () => screen.getByTestId("requirement-links-apply");

describe("RequirementLinksModal", () => {
  it("lists the requirements under the mods that require them", async () => {
    renderModal();

    const sections = screen.getAllByRole("listitem").map((row) => row.closest("section"));
    expect(screen.getByText("Native Settings")).toBeInTheDocument();
    expect(screen.getByText("Scannable Stash")).toBeInTheDocument();
    expect(new Set(sections).size).toBe(2);

    await settleTransitions();
  });

  it("opens each requirement on how it's saved, and a new one on Required", async () => {
    renderModal();

    const checked = (targetName: string) =>
      within(rowOf(targetName)).getByRole("radio", { checked: true }).textContent;
    expect(checked("CET")).toBe("Required");
    expect(checked("RED4ext")).toBe("Optional");
    expect(checked("ArchiveXL")).toBe("Ignore");
    expect(checked("DQC")).toBe("Required");

    await settleTransitions();
  });

  it("marks and counts only the new requirement at first", async () => {
    renderModal();

    expect(markOf("CET")).toHaveAccessibleName("New requirement");
    expect(markOf("RED4ext")).toBeNull();
    expect(markOf("ArchiveXL")).toBeNull();
    expect(markOf("DQC")).toBeNull();
    expect(saveButton()).toHaveTextContent("Save 1 change");
    expect(saveButton()).toBeEnabled();

    await settleTransitions();
  });

  it("marks and counts a changed requirement, until it's changed back", async () => {
    renderModal();

    await choose("RED4ext", "Required");

    expect(markOf("RED4ext")).toHaveAccessibleName("Changed from Optional");
    expect(saveButton()).toHaveTextContent("Save 2 changes");

    await choose("RED4ext", "Optional");

    expect(markOf("RED4ext")).toBeNull();
    expect(saveButton()).toHaveTextContent("Save 1 change");

    await settleTransitions();
  });

  it("can't save while nothing would change", async () => {
    renderModal({ links: [optionalLink, ignoredLink] });

    expect(saveButton()).toHaveTextContent("Save 0 changes");
    expect(saveButton()).toBeDisabled();

    await settleTransitions();
  });

  it("warns of a requirement installed in the wrong version", async () => {
    renderModal();

    expect(within(rowOf("DQC")).getByTestId("requirement-wrong-version")).toHaveTextContent(
      "Version 3.1.5 installed · needs 3.2.0 to 3.3.3",
    );
    expect(within(rowOf("CET")).queryByTestId("requirement-wrong-version")).toBeNull();

    await settleTransitions();
  });

  it("shows a requirement that isn't installed, with nothing to choose or save", async () => {
    renderModal();

    const row = screen.getByTestId("missing-requirement");
    expect(row).toHaveTextContent("Codeware");
    expect(row).toHaveTextContent("Not installed");
    expect(within(row).queryByRole("radiogroup")).toBeNull();
    expect(within(row).queryByTestId("requirement-change-mark")).toBeNull();
    expect(saveButton()).toHaveTextContent("Save 1 change");

    await settleTransitions();
  });

  it("saves the choice of every requirement it lists", async () => {
    const { onAnswer, onHide } = renderModal();

    await choose("CET", "Ignore");
    await userEvent.click(saveButton());

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(
      new Map([
        [newLink.key, "ignore"],
        [optionalLink.key, "recommends"],
        [ignoredLink.key, "ignore"],
        [wrongVersionLink.key, "requires"],
      ]),
    );
    expect(onHide).toHaveBeenCalledOnce();

    await settleTransitions();
  });

  it("saves nothing on Cancel, or on closing it", async () => {
    const { onAnswer } = renderModal();

    await choose("CET", "Optional");
    await userEvent.click(screen.getByTestId("requirement-links-cancel"));
    await userEvent.click(document.querySelector(".nxm-modal-close")!);

    expect(onAnswer.mock.calls).toEqual([[undefined], [undefined]]);

    await settleTransitions();
  });

  it("offers only Close when nothing can be linked", async () => {
    const { onAnswer } = renderModal({ links: [] });

    expect(screen.queryByTestId("requirement-links-apply")).toBeNull();
    expect(screen.queryByTestId("requirement-links-cancel")).toBeNull();

    await userEvent.click(screen.getByTestId("requirement-links-close"));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(undefined);

    await settleTransitions();
  });
});
