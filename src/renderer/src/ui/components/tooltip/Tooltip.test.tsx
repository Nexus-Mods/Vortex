import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";

import { Tooltip, type ITooltipPlacement } from "./Tooltip";
import { TooltipDelayGroup } from "./TooltipDelayGroup";

// --- Helpers ---

interface IRenderOptions {
  content?: string;
  customContent?: React.ReactNode;
  disabled?: boolean;
  interactive?: boolean;
  placement?: ITooltipPlacement;
}

// delay={0} throughout: the 300ms default would mean fake timers in every test.
// content and customContent are mutually exclusive in the type, so the two cases
// are rendered as separate branches — a spread of a dynamic object won't satisfy
// XOr. `in` rather than a nullish check, so an explicitly-undefined content still
// reaches the component instead of picking up the default below.
const renderComponent = (options: IRenderOptions = {}) => {
  const { content, customContent, ...rest } = options;
  const triggerNode = <button type="button">Deploy</button>;

  render(
    "customContent" in options ? (
      <Tooltip customContent={customContent} delay={0} {...rest}>
        {triggerNode}
      </Tooltip>
    ) : (
      <Tooltip
        // Cast covers the guard test, which deliberately passes undefined.
        content={("content" in options ? content : "Deploys every enabled mod") as string}
        delay={0}
        {...rest}
      >
        {triggerNode}
      </Tooltip>
    ),
  );

  return { trigger: screen.getByRole("button", { name: "Deploy" }) };
};

// --- Tests ---

describe("Tooltip", () => {
  it("renders the trigger", () => {
    const { trigger } = renderComponent();
    expect(trigger).toBeInTheDocument();
  });

  it("does not show the content until hovered", () => {
    renderComponent();
    expect(screen.queryByText("Deploys every enabled mod")).not.toBeInTheDocument();
  });

  it("shows the content on hover", async () => {
    const { trigger } = renderComponent();
    await userEvent.hover(trigger);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Deploys every enabled mod");
    });
  });

  it("hides the content again when the pointer leaves", async () => {
    const { trigger } = renderComponent();
    await userEvent.hover(trigger);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    await userEvent.unhover(trigger);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("shows the content on keyboard focus", async () => {
    const { trigger } = renderComponent();
    trigger.focus();
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());
  });

  it("describes the trigger while open, for screen readers", async () => {
    const { trigger } = renderComponent();
    await userEvent.hover(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
    });
  });

  it("dismisses on Escape", async () => {
    const { trigger } = renderComponent();
    await userEvent.hover(trigger);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("gives string content the tooltip's own padding and type styles", async () => {
    const { trigger } = renderComponent();
    await userEvent.hover(trigger);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());
    expect(document.querySelector(".nxm-tooltip-body")).toHaveClass("nxm-tooltip-content");
  });

  it("leaves customContent unstyled so it owns its own layout", async () => {
    const { trigger } = renderComponent({
      customContent: <div data-testid="custom">Custom layout</div>,
    });
    await userEvent.hover(trigger);
    await waitFor(() => expect(screen.getByTestId("custom")).toBeInTheDocument());

    const body = document.querySelector(".nxm-tooltip-body");
    // The wrapper stays (it carries the scroll clamp) but must not add padding.
    expect(body).toBeInTheDocument();
    expect(body).not.toHaveClass("nxm-tooltip-content");
  });

  it("renders rich customContent, not just strings", async () => {
    const { trigger } = renderComponent({
      customContent: (
        <div>
          <h4>Unofficial Skyrim Patch</h4>

          <p>Version 4.2.9b</p>
        </div>
      ),
    });

    await userEvent.hover(trigger);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Unofficial Skyrim Patch" })).toBeInTheDocument();
    });
  });

  it("renders the trigger untouched when disabled", async () => {
    const { trigger } = renderComponent({ disabled: true });
    expect(trigger).not.toHaveAttribute("aria-describedby");

    await userEvent.hover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("stays down when it is disabled while open and then re-enabled", async () => {
    const view = (disabled: boolean) => (
      <Tooltip content="Deploys every enabled mod" delay={0} disabled={disabled}>
        <button type="button">Deploy</button>
      </Tooltip>
    );

    const { rerender } = render(view(false));
    await userEvent.hover(screen.getByRole("button", { name: "Deploy" }));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    // The trigger's own panel takes over, then closes again. Being disabled unregisters
    // the trigger as Floating UI's reference, so a tooltip left open across that comes
    // back before it can be placed, in the corner of the window.
    rerender(view(true));
    rerender(view(false));

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  it("attaches nothing when the body resolves to nothing", async () => {
    // The XOr type normally prevents this; the runtime guard covers a caller
    // passing `content={someMaybeUndefinedValue}`.
    const { trigger } = renderComponent({ content: undefined as unknown as string });
    await userEvent.hover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("escapes clipping ancestors by rendering outside them", async () => {
    render(
      <div data-testid="clipper" style={{ overflow: "hidden" }}>
        <Tooltip content="Not clipped" delay={0}>
          <button type="button">Clipped trigger</button>
        </Tooltip>
      </div>,
    );

    await userEvent.hover(screen.getByRole("button", { name: "Clipped trigger" }));
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());
    expect(screen.getByTestId("clipper")).not.toContainElement(screen.getByRole("tooltip"));
  });
});

describe("TooltipDelayGroup", () => {
  const renderGroup = (props: Parameters<typeof TooltipDelayGroup>[0] = {}) =>
    render(
      <div data-testid="host">
        <TooltipDelayGroup {...props}>
          <button type="button">Deploy</button>
        </TooltipDelayGroup>
      </div>,
    );

  it("renders no element of its own by default", () => {
    renderGroup();
    expect(screen.getByTestId("host").children).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Deploy" }).parentElement).toBe(
      screen.getByTestId("host"),
    );
  });

  it("renders the element given by `as`, with its props, around the group", () => {
    renderGroup({ as: "div", className: "flex gap-x-2" });

    const wrapper = screen.getByRole("button", { name: "Deploy" }).parentElement;
    expect(wrapper?.tagName).toBe("DIV");
    expect(wrapper).toHaveClass("flex", "gap-x-2");
    expect(screen.getByTestId("host")).toContainElement(wrapper);
  });

  it("still shares its delay with the tooltips inside a wrapper", async () => {
    render(
      <TooltipDelayGroup as="div" delay={0}>
        <Tooltip content="Deploys every enabled mod">
          <button type="button">Deploy</button>
        </Tooltip>
      </TooltipDelayGroup>,
    );

    await userEvent.hover(screen.getByRole("button", { name: "Deploy" }));
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());
  });
});
