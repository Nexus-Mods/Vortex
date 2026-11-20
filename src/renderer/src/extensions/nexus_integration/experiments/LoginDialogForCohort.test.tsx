import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const experiment = vi.hoisted(() => ({ cohort: "test" as "test" | "control" }));

vi.mock("./loginPromptExperiment", () => ({
  useLoginPromptCohort: () => experiment.cohort,
  fixLoginPromptCohort: () => experiment.cohort,
}));
vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({ session: { nexus: {} } }),
}));
vi.mock("../components/login_dialog/LoginDialog", () => ({
  LoginDialog: () => <div>new dialog</div>,
}));
vi.mock("../views/LoginDialog", () => ({ default: () => <div>old dialog</div> }));

import { LoginDialogForCohort } from "./LoginDialogForCohort";

const props = {
  visible: true,
  onHide: vi.fn(),
  onCancelLogin: vi.fn(),
  onReceiveCode: vi.fn(() => Promise.resolve()),
};

describe("LoginDialogForCohort", () => {
  it("shows the new dialog to the test cohort", () => {
    experiment.cohort = "test";
    render(<LoginDialogForCohort {...props} />);

    expect(screen.getByText("new dialog")).toBeInTheDocument();
  });

  it("shows the old dialog to the control cohort", () => {
    experiment.cohort = "control";
    render(<LoginDialogForCohort {...props} />);

    expect(screen.getByText("old dialog")).toBeInTheDocument();
  });
});
