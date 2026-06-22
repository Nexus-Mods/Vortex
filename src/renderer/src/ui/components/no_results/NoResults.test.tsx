import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { NoResults } from "./NoResults";

// --- Helpers ---

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- Tests ---

describe("NoResults", () => {
  describe("content", () => {
    it("renders the title", () => {
      render(<NoResults title="Nothing here" />);
      expect(screen.getByText("Nothing here")).toBeInTheDocument();
    });

    it("renders a message when provided", () => {
      render(<NoResults message="Try again later" title="Nothing here" />);
      expect(screen.getByText("Try again later")).toBeInTheDocument();
    });

    it("renders no message paragraph when message is omitted and not an error", () => {
      render(<NoResults title="Nothing here" />);
      expect(screen.queryByText(/contact our support team/i)).not.toBeInTheDocument();
    });

    it("renders an icon when iconPath is provided", () => {
      render(<NoResults iconPath="M0 0h24v24H0z" title="Nothing here" />);
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });

    it("renders no icon by default", () => {
      render(<NoResults title="Nothing here" />);
      expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("falls back to default error title and message", () => {
      render(<NoResults isError={true} title={undefined as unknown as string} />);
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText(/contact our support team/i)).toBeInTheDocument();
    });

    it("shows an icon when isError even without an iconPath", () => {
      // children suppress the default button (whose icon also has role=presentation)
      render(
        <NoResults isError={true} title="">
          <span />
        </NoResults>,
      );
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });

    it("renders a Contact support button that opens the help URL", async () => {
      const openUrl = vi.fn();
      (window as unknown as { api: { shell: { openUrl: typeof openUrl } } }).api.shell = {
        openUrl,
      };
      render(<NoResults isError={true} title="" />);

      await userEvent.click(screen.getByRole("button", { name: /contact support/i }));
      expect(openUrl).toHaveBeenCalledWith(expect.stringContaining("help.nexusmods.com"));
    });

    it("renders custom children instead of the default error button", () => {
      render(
        <NoResults isError={true} title="">
          <div data-testid="custom">custom</div>
        </NoResults>,
      );
      expect(screen.getByTestId("custom")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /contact support/i })).not.toBeInTheDocument();
    });
  });

  describe("appearance", () => {
    it("applies the subdued icon colour by default", () => {
      render(<NoResults iconPath="M0 0h24v24H0z" title="Nothing here" />);
      expect(screen.getByRole("presentation")).toHaveClass("text-neutral-subdued");
    });

    it('applies the success icon colour for appearance="success"', () => {
      render(<NoResults appearance="success" iconPath="M0 0h24v24H0z" title="Nothing here" />);
      expect(screen.getByRole("presentation")).toHaveClass("text-success-strong");
    });
  });

  it("merges a custom className on the container", () => {
    const { container } = render(<NoResults className="my-class" title="Nothing here" />);
    expect(container.firstChild).toHaveClass("my-class");
  });
});
