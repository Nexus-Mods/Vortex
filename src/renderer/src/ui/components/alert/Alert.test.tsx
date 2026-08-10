import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { Alert, type AlertSeverity } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";

// --- Helpers ---

const getBar = () => screen.getByRole("status");

const getIcon = () => document.querySelector(".nxm-alert-icon");

const getDismiss = () => screen.getByRole("button", { name: "Dismiss" });

// --- Tests ---

describe("Alert", () => {
  describe("rendering", () => {
    it("renders its message", () => {
      render(<Alert>Disk space full</Alert>);
      expect(screen.getByText("Disk space full")).toBeInTheDocument();
    });

    it('exposes the bar as role="status"', () => {
      render(<Alert>Heads up</Alert>);
      expect(getBar()).toBeInTheDocument();
    });

    it("renders a severity icon", () => {
      render(<Alert>Heads up</Alert>);
      expect(getIcon()).toBeInTheDocument();
    });

    it("defaults to the info severity", () => {
      render(<Alert>Heads up</Alert>);
      expect(getBar()).toHaveClass("nxm-alert-info");
    });

    it("merges a custom className with the base classes", () => {
      render(<Alert className="mx-6">Heads up</Alert>);
      expect(getBar()).toHaveClass("nxm-alert", "nxm-alert-info", "mx-6");
    });

    it("passes through arbitrary HTML attributes", () => {
      render(<Alert data-testid="banner">Heads up</Alert>);
      expect(screen.getByTestId("banner")).toBeInTheDocument();
    });

    it("lets a caller override the role", () => {
      render(<Alert role="alert">Disk space full</Alert>);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  describe("severity", () => {
    const severities: AlertSeverity[] = ["info", "success", "warning", "danger"];

    it.each(severities)("applies the %s severity class", (severity) => {
      render(<Alert severity={severity}>Heads up</Alert>);
      expect(getBar()).toHaveClass(`nxm-alert-${severity}`);
    });

    it("gives each severity a distinct icon", () => {
      const paths = severities.map((severity) => {
        const { unmount } = render(<Alert severity={severity}>Heads up</Alert>);
        const path = getIcon()?.querySelector("path")?.getAttribute("d");
        unmount();
        return path;
      });

      expect(new Set(paths).size).toBe(severities.length);
    });

    it("leaves the surface class untouched across severities", () => {
      // Severity colours the icon only, so the bar itself must not gain a
      // severity-specific background utility.
      render(<Alert severity="danger">Disk space full</Alert>);
      expect(getBar().className).not.toMatch(/bg-/);
    });
  });

  describe("action", () => {
    it("renders no action region when none is given", () => {
      render(<Alert>Heads up</Alert>);
      expect(document.querySelector(".nxm-alert-action")).not.toBeInTheDocument();
    });

    it("renders an action after the message", () => {
      render(
        <Alert action={<Button size="xs">Restart Vortex</Button>}>
          You need to restart Vortex to apply changes
        </Alert>,
      );
      expect(screen.getByRole("button", { name: "Restart Vortex" })).toBeInTheDocument();
    });

    it("calls the action's onClick", async () => {
      const onClick = vi.fn();
      render(
        <Alert
          action={
            <Button size="xs" onClick={onClick}>
              Restart Vortex
            </Button>
          }
        >
          Restart needed
        </Alert>,
      );

      await userEvent.click(screen.getByRole("button", { name: "Restart Vortex" }));
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  describe("dismissal", () => {
    it("renders no close button without an onDismiss", () => {
      render(<Alert>Heads up</Alert>);
      expect(document.querySelector(".nxm-alert-dismiss")).not.toBeInTheDocument();
    });

    it("renders a close button when given an onDismiss", () => {
      render(<Alert onDismiss={vi.fn()}>Heads up</Alert>);
      expect(getDismiss()).toBeInTheDocument();
    });

    it("lets a caller relabel the close button", () => {
      render(
        <Alert dismissLabel="Hide this" onDismiss={vi.fn()}>
          Heads up
        </Alert>,
      );
      expect(screen.getByRole("button", { name: "Hide this" })).toBeInTheDocument();
    });

    it("hides the bar once dismissed", async () => {
      render(<Alert onDismiss={vi.fn()}>Heads up</Alert>);

      await userEvent.click(getDismiss());
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("calls onDismiss once", async () => {
      const onDismiss = vi.fn();
      render(<Alert onDismiss={onDismiss}>Heads up</Alert>);

      await userEvent.click(getDismiss());
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it("keeps the action working alongside the close button", async () => {
      const onClick = vi.fn();
      const onDismiss = vi.fn();
      render(
        <Alert
          action={
            <Button size="xs" onClick={onClick}>
              Restart Vortex
            </Button>
          }
          onDismiss={onDismiss}
        >
          Restart needed
        </Alert>,
      );

      await userEvent.click(screen.getByRole("button", { name: "Restart Vortex" }));
      expect(onClick).toHaveBeenCalledOnce();
      expect(onDismiss).not.toHaveBeenCalled();
      expect(getBar()).toBeInTheDocument();
    });
  });
});
