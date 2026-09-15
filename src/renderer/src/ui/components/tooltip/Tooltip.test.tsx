import type { OpenChangeReason } from "@floating-ui/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

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

  // A disabled tooltip used to keep its hover, focus and delay-group machinery live. It
  // rendered nothing, but it still claimed the delay group's currentId, and the group
  // closes whichever member is not current — so the real tooltip on the same trigger (the
  // spine's download button has both) was shut again the moment it opened, and you had to
  // hover twice.
  it("asks for nothing while disabled, so it cannot disturb another tooltip", async () => {
    const onOpenChange = vi.fn();
    render(
      <Tooltip disabled content="Downloads" delay={0} onOpenChange={onOpenChange}>
        <button type="button">Downloads</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Downloads" });

    await userEvent.hover(trigger);
    trigger.focus();
    await userEvent.click(document.body);

    expect(onOpenChange).not.toHaveBeenCalled();
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

describe("Tooltip with a controlled open state", () => {
  const renderControlled = (
    open: boolean,
    onOpenChange: (open: boolean, reason?: OpenChangeReason) => void = () => undefined,
  ) => {
    render(
      <Tooltip
        content="Deploys every enabled mod"
        delay={0}
        open={open}
        onOpenChange={onOpenChange}
      >
        <button type="button">Deploy</button>
      </Tooltip>,
    );

    return { trigger: screen.getByRole("button", { name: "Deploy" }) };
  };

  it("shows the content without anyone hovering", async () => {
    renderControlled(true);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());
  });

  it("stays down on hover, because the caller owns the answer", async () => {
    const { trigger } = renderControlled(false);
    await userEvent.hover(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("reports a hover so the caller can tell it from an open it asked for", async () => {
    const onOpenChange = vi.fn();
    const { trigger } = renderControlled(false, onOpenChange);

    await userEvent.hover(trigger);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true, "hover"));
  });

  it("reports a dismissal, so the caller can stop saying open", async () => {
    const onOpenChange = vi.fn();
    renderControlled(true, onOpenChange);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, "escape-key"));
  });
});

describe("Tooltip that persists", () => {
  const renderPersistent = (
    persistent: boolean,
    onOpenChange: (open: boolean, reason?: OpenChangeReason) => void = () => undefined,
  ) => {
    render(
      <>
        <Tooltip
          content="Downloading Eastern Vagabond Armor"
          delay={0}
          open
          persistent={persistent}
          onOpenChange={onOpenChange}
        >
          <button type="button">Downloads</button>
        </Tooltip>

        <button type="button">Somewhere else</button>
      </>,
    );

    return {
      elsewhere: screen.getByRole("button", { name: "Somewhere else" }),
      trigger: screen.getByRole("button", { name: "Downloads" }),
    };
  };

  it("ignores a press elsewhere in the app", async () => {
    const onOpenChange = vi.fn();
    const { elsewhere } = renderPersistent(true, onOpenChange);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    await userEvent.click(elsewhere);

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false, "outside-press");
  });

  it("ignores a press on its own trigger", async () => {
    const onOpenChange = vi.fn();
    const { trigger } = renderPersistent(true, onOpenChange);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    await userEvent.click(trigger);

    expect(onOpenChange).not.toHaveBeenCalledWith(false, "reference-press");
  });

  it("still closes on Escape, so it is never a trap", async () => {
    const onOpenChange = vi.fn();
    renderPersistent(true, onOpenChange);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, "escape-key"));
  });

  it("yields to a press elsewhere once it stops persisting", async () => {
    const onOpenChange = vi.fn();
    const { elsewhere } = renderPersistent(false, onOpenChange);
    await waitFor(() => expect(screen.getByRole("tooltip")).toBeInTheDocument());

    await userEvent.click(elsewhere);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, "outside-press"));
  });

  // A delay group closes whichever member is not current, so only one shows at a time.
  // That is the mechanism an announcement has to be exempt from.
  const renderInGroup = (persistent: boolean, onOpenChange: Mock) => {
    render(
      <TooltipDelayGroup as="div" delay={0}>
        <Tooltip
          content="Downloading Eastern Vagabond Armor"
          delay={0}
          open
          persistent={persistent}
          onOpenChange={onOpenChange}
        >
          <button type="button">Downloads</button>
        </Tooltip>

        <Tooltip content="Notifications" delay={0}>
          <button type="button">Bell</button>
        </Tooltip>
      </TooltipDelayGroup>,
    );
  };

  it("is not closed by a neighbour opening in the same delay group", async () => {
    const onOpenChange = vi.fn();
    renderInGroup(true, onOpenChange);
    await waitFor(() => expect(screen.getAllByRole("tooltip")).toHaveLength(1));

    await userEvent.hover(screen.getByRole("button", { name: "Bell" }));
    await waitFor(() => expect(screen.getAllByRole("tooltip")).toHaveLength(2));

    expect(onOpenChange).not.toHaveBeenCalledWith(false, undefined);
  });

  it("is asked to close by a neighbour when it is not persisting", async () => {
    const onOpenChange = vi.fn();
    renderInGroup(false, onOpenChange);
    await waitFor(() => expect(screen.getAllByRole("tooltip")).toHaveLength(1));

    await userEvent.hover(screen.getByRole("button", { name: "Bell" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false, undefined));
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
