import { render, screen } from "@testing-library/react";
import React from "react";
import type * as ReactRedux from "react-redux";
import { describe, expect, it, vi } from "vitest";

import type { IDownload } from "@/extensions/download_management/types/IDownload";
import type { IState } from "@/types/IState";

// Only AdultAwareImage reaches the store now, for the blur preference.
vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRedux>()),
  useSelector: (selector: (state: IState) => unknown) =>
    selector({ persistent: {} } as unknown as IState),
}));

import { DownloadFlyout, formatRemaining } from "./DownloadFlyout";
import type { DownloadEta } from "./useDownloadEta.hook";

// --- Helpers ---

const download = (overrides: Partial<IDownload> = {}): IDownload =>
  ({
    id: "dl1",
    modInfo: {},
    received: 0,
    size: 1000,
    state: "started",
    urls: [],
    ...overrides,
  }) as unknown as IDownload;

const renderComponent = ({
  dl = download(),
  eta = { status: "estimating" } as DownloadEta,
  otherCount = 0,
}: { dl?: IDownload | undefined; eta?: DownloadEta; otherCount?: number } = {}) =>
  render(<DownloadFlyout download={dl} eta={eta} otherCount={otherCount} />);

// --- Tests ---

describe("DownloadFlyout", () => {
  it("names nothing until the name lands", () => {
    // The on-disk name is a placeholder until the download completes.
    renderComponent({ dl: download({ localPath: "__vortex_tmp_9f2c" }) });

    expect(screen.queryByTestId("download-flyout-name")).not.toBeInTheDocument();
    // The status line still says something, so the row isn't blank.
    expect(screen.getByTestId("download-flyout-estimating")).toBeInTheDocument();
  });

  it("names the file once there is a name to give", () => {
    renderComponent({ dl: download({ localPath: "EasternVagabondArmor-1.2.zip" }) });

    expect(screen.getByTestId("download-flyout-name")).toBeInTheDocument();
  });

  it("waits for the thumbnail while the mod metadata is still coming", () => {
    renderComponent({ dl: download({ modInfo: { nexus: { ids: { modId: 123 } } } }) });

    expect(document.querySelector(".nxm-image-spinner")).toBeInTheDocument();
  });

  it("leaves the frame empty for a download that will never have one", () => {
    // No nexus ids means no metadata fetch, so no image is on its way.
    renderComponent({ dl: download() });

    expect(document.querySelector(".nxm-image-spinner")).not.toBeInTheDocument();
  });

  it("counts the downloads queued behind the one it names", () => {
    renderComponent({ otherCount: 10 });
    expect(screen.getByTestId("download-flyout-more")).toBeInTheDocument();
  });

  it("says nothing about others when there are none", () => {
    renderComponent();
    expect(screen.queryByTestId("download-flyout-more")).not.toBeInTheDocument();
  });

  it("says it is calculating while the estimate is still pending", () => {
    renderComponent({ eta: { status: "estimating" } });

    expect(screen.getByTestId("download-flyout-estimating")).toBeInTheDocument();
    expect(screen.queryByTestId("download-flyout-remaining")).not.toBeInTheDocument();
  });

  it("shows the time left once there is an estimate", () => {
    renderComponent({ eta: { seconds: 486, status: "ready" } });

    expect(screen.getByTestId("download-flyout-remaining")).toBeInTheDocument();
    expect(screen.queryByTestId("download-flyout-estimating")).not.toBeInTheDocument();
  });

  // The panel is still on screen for its exit transition when a download finishes, so a
  // status line that reappeared here would flash on the way out.
  it("says nothing on the status line when there is no estimate to make", () => {
    renderComponent({ eta: { status: "unavailable" } });

    expect(screen.queryByTestId("download-flyout-estimating")).not.toBeInTheDocument();
    expect(screen.queryByTestId("download-flyout-remaining")).not.toBeInTheDocument();
  });

  it("has nothing to show for a download that is no longer there", () => {
    renderComponent({ dl: undefined, eta: { status: "unavailable" } });

    expect(screen.queryByTestId("download-flyout-name")).not.toBeInTheDocument();
    expect(screen.queryByTestId("download-flyout-estimating")).not.toBeInTheDocument();
    expect(screen.queryByTestId("download-flyout-remaining")).not.toBeInTheDocument();
  });
});

describe("formatRemaining", () => {
  it("drops the leading zero, so minutes read as the design has them", () => {
    expect(formatRemaining(486)).toBe("8:06");
  });

  it("keeps two-digit minutes intact", () => {
    expect(formatRemaining(754)).toBe("12:34");
  });

  it("keeps the hour when there is one", () => {
    expect(formatRemaining(3723)).toBe("1:02:03");
  });

  it("rounds part-seconds up rather than down to zero", () => {
    expect(formatRemaining(0.4)).toBe("0:01");
  });
});
