import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type * as ReactRedux from "react-redux";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import type { IState } from "@/types/IState";

import type { SpineSelection } from "../SpineContext";

// The component derives everything from the store via a selector, so useSelector is
// run against a hand-built state rather than a real store — that keeps the progress
// maths under test instead of stubbing it out.
// Annotated rather than asserted so `selection` stays checked against the real union.
const mocks = vi.hoisted(
  (): { selectDownloads: Mock; selection: SpineSelection; state: IState } => ({
    state: { persistent: { downloads: { files: {}, speed: 0 } } } as unknown as IState,
    selectDownloads: vi.fn(),
    selection: { type: "home" },
  }),
);

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRedux>()),
  useSelector: (selector: (state: IState) => unknown) => selector(mocks.state),
}));

vi.mock("../SpineContext", () => ({
  useSpineContext: () => ({
    selection: mocks.selection,
    selectDownloads: mocks.selectDownloads,
  }),
}));

import { DownloadButton } from "./DownloadButton";

// --- Helpers ---

const MB = 1024 * 1024;

/** Geometry mirrored from ProgressRing so offsets can be checked against real numbers. */
const CIRCUMFERENCE = 2 * Math.PI * ((48 - 4) / 2);

interface IDownloadFixture {
  state: string;
  size?: number;
  received: number;
}

const setStore = (downloads: IDownloadFixture[], speedMBps = 0) => {
  mocks.state = {
    persistent: {
      downloads: {
        files: Object.fromEntries(downloads.map((dl, i) => [`dl${i}`, dl])),
        speed: speedMBps * MB,
      },
    },
  } as unknown as IState;
};

// Only the variants that carry no extra data — "game" would need a gameId with it.
const setSelection = (type: "downloads" | "home") => {
  mocks.selection = { type };
};

const renderComponent = () => {
  const { container } = render(<DownloadButton />);
  const circles = () => [...container.querySelectorAll("circle")];

  return {
    container,
    button: within(container).getByRole("button", { name: "Downloads" }),
    /** ProgressRing renders the track first, then the progress arc over it. */
    track: () => circles()[0],
    arc: () => circles()[1],
    hasRing: () => circles().length > 0,
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  setStore([]);
  setSelection("home");
});

// --- Tests ---

describe("DownloadButton", () => {
  describe("idle", () => {
    it("shows the download icon and no progress ring", () => {
      const { container, hasRing } = renderComponent();
      expect(hasRing()).toBe(false);
      expect(container.querySelector("svg path")).toBeInTheDocument();
    });

    it("outlines itself when the downloads page is open", () => {
      setSelection("downloads");
      const { button } = renderComponent();
      expect(button).toHaveClass("border-neutral-strong", "bg-surface-translucent-low");
    });

    it("stays subdued when another page is open", () => {
      const { button } = renderComponent();
      expect(button).toHaveClass("border-stroke-weak");
      expect(button).not.toHaveClass("bg-surface-translucent-low");
    });
  });

  describe("downloading", () => {
    beforeEach(() => {
      setStore([{ state: "started", size: 1000, received: 250 }], 8.6);
    });

    it("reports the current speed in MB/s", () => {
      const { button } = renderComponent();
      expect(button).toHaveTextContent("8.6");
      expect(button).toHaveTextContent("mb/s");
    });

    it("draws the arc in proportion to bytes received", () => {
      const { arc } = renderComponent();
      // 250 of 1000 bytes → a quarter sweep, so three quarters remain as offset.
      expect(Number(arc().getAttribute("stroke-dashoffset"))).toBeCloseTo(CIRCUMFERENCE * 0.75, 3);
    });

    it("treats several downloads as one combined total", () => {
      setStore(
        [
          { state: "started", size: 1000, received: 500 },
          { state: "started", size: 1000, received: 250 },
        ],
        4,
      );
      const { arc } = renderComponent();
      // 750 of 2000 → 37.5%.
      expect(Number(arc().getAttribute("stroke-dashoffset"))).toBeCloseTo(CIRCUMFERENCE * 0.625, 3);
    });
  });

  // LAZ-984: the ring is the button's only active affordance while a download is
  // running — there's no border in that branch — so both of its strokes have to
  // respond to selection.
  describe("ring colours", () => {
    it("keeps the track subdued while another page is open", () => {
      setStore([{ state: "started", size: 1000, received: 250 }], 8.6);
      const { track } = renderComponent();
      expect(track()).toHaveClass("stroke-stroke-weak");
    });

    it("lifts the track when the downloads page is open", () => {
      setStore([{ state: "started", size: 1000, received: 250 }], 8.6);
      setSelection("downloads");
      const { track } = renderComponent();
      expect(track()).toHaveClass("stroke-stroke-moderate");
    });

    it("draws the arc in the accent colour while downloading", () => {
      setStore([{ state: "started", size: 1000, received: 250 }], 8.6);
      const { arc } = renderComponent();
      expect(arc()).toHaveClass("stroke-info-subdued");
    });

    it("draws the arc in the foreground colour when selected", () => {
      setStore([{ state: "started", size: 1000, received: 250 }], 8.6);
      setSelection("downloads");
      const { arc } = renderComponent();
      expect(arc()).toHaveClass("stroke-neutral-strong");
    });

    it("mutes the arc while paused", () => {
      setStore([{ state: "paused", size: 1000, received: 250 }]);
      const { arc } = renderComponent();
      expect(arc()).toHaveClass("stroke-stroke-moderate");
    });

    it("still marks a paused download as selected", () => {
      setStore([{ state: "paused", size: 1000, received: 250 }]);
      setSelection("downloads");
      const { arc, track } = renderComponent();
      expect(arc()).toHaveClass("stroke-neutral-strong");
      expect(track()).toHaveClass("stroke-stroke-moderate");
    });
  });

  describe("paused", () => {
    it('labels itself "paused" instead of showing a speed', () => {
      setStore([{ state: "paused", size: 1000, received: 250 }]);
      const { button } = renderComponent();
      expect(button).toHaveTextContent("paused");
      expect(button).not.toHaveTextContent("mb/s");
    });

    it("is not paused while any download is still running", () => {
      setStore(
        [
          { state: "paused", size: 1000, received: 250 },
          { state: "started", size: 1000, received: 250 },
        ],
        2,
      );
      const { button } = renderComponent();
      expect(button).toHaveTextContent("mb/s");
      expect(button).not.toHaveTextContent("paused");
    });
  });

  describe("interaction", () => {
    it("opens the downloads page when clicked", async () => {
      const { button } = renderComponent();

      await userEvent.click(button);

      expect(mocks.selectDownloads).toHaveBeenCalledTimes(1);
    });
  });
});
