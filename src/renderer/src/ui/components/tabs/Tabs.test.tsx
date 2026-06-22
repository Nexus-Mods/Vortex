import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { TabButton } from "./Tab";
import { TabBar } from "./TabBar";
import { TabPanel } from "./TabPanel";
import { TabProvider } from "./tabs.context";

// --- Helpers ---

afterEach(() => {
  cleanup();
});

const Harness = ({
  disabledThird = false,
  initial = "One",
  tabType,
}: {
  disabledThird?: boolean;
  initial?: string;
  tabType?: "primary" | "secondary";
}) => {
  const [tab, setTab] = useState(initial);

  return (
    <TabProvider tab={tab} tabListId="test" tabType={tabType} onSetSelectedTab={setTab}>
      <TabBar>
        <TabButton name="One" />
        <TabButton count={5} name="Two" />
        <TabButton disabled={disabledThird} name="Three" />
      </TabBar>

      <TabPanel name="One">Panel One</TabPanel>
      <TabPanel name="Two">Panel Two</TabPanel>
      <TabPanel name="Three">Panel Three</TabPanel>
    </TabProvider>
  );
};

const getTab = (name: RegExp) => screen.getByRole("tab", { name });

// --- Tests ---

describe("Tabs", () => {
  describe("structure", () => {
    it("renders a tablist with one tab per TabButton", () => {
      render(<Harness />);
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(3);
    });

    it("renders a count on a tab when provided", () => {
      render(<Harness />);
      expect(getTab(/two/i)).toHaveTextContent("5");
    });
  });

  describe("selection", () => {
    it("shows only the selected tab's panel", () => {
      render(<Harness />);
      expect(screen.getByText("Panel One")).toBeInTheDocument();
      expect(screen.queryByText("Panel Two")).not.toBeInTheDocument();
    });

    it("marks the selected tab with aria-selected", () => {
      render(<Harness />);
      expect(getTab(/one/i)).toHaveAttribute("aria-selected", "true");
      expect(getTab(/two/i)).toHaveAttribute("aria-selected", "false");
    });

    it("adds the selected modifier class to the active tab", () => {
      render(<Harness />);
      expect(getTab(/one/i)).toHaveClass("nxm-tab-button-selected");
    });

    it("links a tab to its panel via aria-controls", () => {
      render(<Harness />);
      expect(getTab(/one/i)).toHaveAttribute("aria-controls", "tabcontent-one");
    });

    it("switches the panel when another tab is clicked", async () => {
      render(<Harness />);
      await userEvent.click(getTab(/two/i));
      expect(screen.getByText("Panel Two")).toBeInTheDocument();
      expect(screen.queryByText("Panel One")).not.toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("selects the next tab on ArrowRight", async () => {
      render(<Harness />);
      getTab(/one/i).focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(screen.getByText("Panel Two")).toBeInTheDocument();
    });

    it("wraps to the first tab on ArrowRight from the last", async () => {
      render(<Harness initial="Three" />);
      getTab(/three/i).focus();
      await userEvent.keyboard("{ArrowRight}");
      expect(screen.getByText("Panel One")).toBeInTheDocument();
    });

    it("jumps to the first tab on Home", async () => {
      render(<Harness initial="Three" />);
      getTab(/three/i).focus();
      await userEvent.keyboard("{Home}");
      expect(screen.getByText("Panel One")).toBeInTheDocument();
    });
  });

  describe("disabled tab", () => {
    it("disables the tab and adds the disabled class", () => {
      render(<Harness disabledThird={true} />);
      expect(getTab(/three/i)).toBeDisabled();
      expect(getTab(/three/i)).toHaveClass("nxm-tab-button-disabled");
    });
  });

  describe("tabType", () => {
    it("applies the primary bar class by default", () => {
      const { container } = render(<Harness />);
      expect(container.querySelector(".nxm-tab-bar")).toHaveClass("nxm-tab-bar-primary");
    });

    it("applies the secondary bar class when tabType is secondary", () => {
      const { container } = render(<Harness tabType="secondary" />);
      expect(container.querySelector(".nxm-tab-bar")).toHaveClass("nxm-tab-bar-secondary");
    });
  });

  it("throws when a tab is used outside a TabProvider", () => {
    // suppress the expected React error boundary console output
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<TabBar>x</TabBar>)).toThrow(/TabProvider/);
    spy.mockRestore();
  });
});
