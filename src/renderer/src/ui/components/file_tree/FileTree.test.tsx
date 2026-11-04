import { relativePath, type RelativePath } from "@nexusmods/paths";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFileTree } from "./buildTree";
import { FileTree, type IFileTreeProps } from "./FileTree";
import type { IFileTreeNode } from "./types";

// --- Helpers ---

const tree = buildFileTree(
  ["dir/a.txt", "dir/sub/b.txt", "empty/", "root.txt"].map((raw) => ({
    path: relativePath(raw),
    kind: raw.endsWith("/") ? ("directory" as const) : ("file" as const),
  })),
);

type IHarnessProps = Partial<Omit<IFileTreeProps, "expandedPaths">> & {
  initiallyExpanded?: string[];
};

const Harness = ({
  initiallyExpanded = [],
  nodes = tree,
  onExpandedChange,
  onSelect,
  selectedPath: initialSelectedPath,
  ...props
}: IHarnessProps) => {
  const [expanded, setExpanded] = useState<ReadonlySet<RelativePath>>(
    new Set(initiallyExpanded.map(relativePath)),
  );
  const [selectedPath, setSelectedPath] = useState(initialSelectedPath);

  return (
    <FileTree
      aria-label="Tree"
      expandedPaths={expanded}
      nodes={nodes}
      selectedPath={selectedPath}
      onExpandedChange={(paths) => {
        setExpanded(paths);
        onExpandedChange?.(paths);
      }}
      onSelect={(node) => {
        setSelectedPath(node.path);
        onSelect?.(node);
      }}
      {...props}
    />
  );
};

const queryItem = (path: string): HTMLElement | undefined =>
  screen.queryAllByRole("treeitem").find((element) => element.dataset.path === path);

const item = (path: string): HTMLElement => {
  const found = queryItem(path);

  if (found === undefined) {
    throw new Error(`No tree item for "${path}"`);
  }

  return found;
};

const visiblePaths = (): string[] =>
  screen.queryAllByRole("treeitem").map((element) => element.dataset.path ?? "");

const focus = (path: string) => {
  act(() => {
    item(path).focus();
  });
};

const selectedWith = (path: string) => expect.objectContaining({ path });

describe("FileTree", () => {
  describe("rendering", () => {
    it("shows only the top level while directories are closed", () => {
      render(<Harness />);

      expect(visiblePaths()).toEqual(["dir", "empty", "root.txt"]);
    });

    it("shows the children of the open directories", () => {
      render(<Harness initiallyExpanded={["dir"]} />);

      expect(visiblePaths()).toEqual(["dir", "dir/sub", "dir/a.txt", "empty", "root.txt"]);
    });

    it("describes the tree to assistive technology", () => {
      render(<Harness initiallyExpanded={["dir"]} />);

      expect(screen.getByRole("tree")).toBeInTheDocument();
      expect(item("dir")).toHaveAttribute("aria-level", "1");
      expect(item("dir")).toHaveAttribute("aria-expanded", "true");
      expect(item("dir")).toHaveAttribute("aria-posinset", "1");
      expect(item("dir")).toHaveAttribute("aria-setsize", "3");
      expect(item("dir/a.txt")).toHaveAttribute("aria-level", "2");
      expect(item("dir/a.txt")).not.toHaveAttribute("aria-expanded");
    });

    it("applies the class from getNodeClassName and the content from renderNode", () => {
      render(
        <Harness
          getNodeClassName={({ kind }) => (kind === "file" ? "is-file" : undefined)}
          renderNode={({ path }) => <span data-testid="label">{`label:${path}`}</span>}
        />,
      );

      expect(item("root.txt")).toHaveClass("is-file");
      expect(item("dir")).not.toHaveClass("is-file");
      expect(within(item("root.txt")).getByTestId("label")).toHaveTextContent("label:root.txt");
    });
  });

  describe("opening and closing", () => {
    it("opens and closes a directory with its arrow", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(within(item("dir")).getByTestId("file-tree-toggle"));
      expect(visiblePaths()).toContain("dir/a.txt");

      await user.click(within(item("dir")).getByTestId("file-tree-toggle"));
      expect(visiblePaths()).not.toContain("dir/a.txt");
    });

    it("doesn't select the node when its arrow is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);

      await user.click(within(item("dir")).getByTestId("file-tree-toggle"));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("doesn't open a directory when its row is clicked", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(item("dir"));

      expect(item("dir")).toHaveAttribute("aria-expanded", "false");
    });

    it("gives a directory known to be empty no arrow and no expanded state", () => {
      render(<Harness />);

      expect(within(item("empty")).queryByTestId("file-tree-toggle")).not.toBeInTheDocument();
      expect(item("empty")).not.toHaveAttribute("aria-expanded");
    });

    it("doesn't open a directory known to be empty with the keyboard", async () => {
      const user = userEvent.setup();
      const onExpandedChange = vi.fn();
      render(<Harness onExpandedChange={onExpandedChange} />);

      focus("empty");
      await user.keyboard("{ArrowRight}");

      expect(onExpandedChange).not.toHaveBeenCalled();
    });
  });

  describe("selection", () => {
    it("selects a file or a directory when its row is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);

      await user.click(item("root.txt"));
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("root.txt"));

      await user.click(item("dir"));
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("dir"));
    });

    it("marks only the selected path as selected", () => {
      render(<Harness selectedPath={relativePath("root.txt")} />);

      expect(item("root.txt")).toHaveAttribute("aria-selected", "true");
      expect(item("dir")).toHaveAttribute("aria-selected", "false");
    });

    it("selects the focused node on Enter and Space", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);

      focus("root.txt");
      await user.keyboard("{Enter}");
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("root.txt"));

      focus("dir");
      await user.keyboard(" ");
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("dir"));
    });
  });

  describe("keyboard navigation", () => {
    it("lets the first item be tabbed to, and then whichever was last focused", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      expect(item("dir")).toHaveAttribute("tabindex", "0");
      expect(item("root.txt")).toHaveAttribute("tabindex", "-1");

      await user.click(item("root.txt"));

      expect(item("root.txt")).toHaveAttribute("tabindex", "0");
      expect(item("dir")).toHaveAttribute("tabindex", "-1");
    });

    it("moves focus and the selection with Down and Up", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);

      focus("dir");

      await user.keyboard("{ArrowDown}");
      expect(item("empty")).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("empty"));

      await user.keyboard("{ArrowDown}");
      expect(item("root.txt")).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("root.txt"));

      await user.keyboard("{ArrowUp}");
      expect(item("empty")).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("empty"));
    });

    it("steps into the children of an open directory", async () => {
      const user = userEvent.setup();
      render(<Harness initiallyExpanded={["dir"]} />);

      focus("dir");
      await user.keyboard("{ArrowDown}");

      expect(item("dir/sub")).toHaveFocus();
    });

    it("stays put at either end", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);

      focus("dir");
      await user.keyboard("{ArrowUp}");
      expect(item("dir")).toHaveFocus();

      focus("root.txt");
      await user.keyboard("{ArrowDown}");
      expect(item("root.txt")).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("jumps to the first and last item with Home and End, selecting them", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);

      focus("empty");

      await user.keyboard("{End}");
      expect(item("root.txt")).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("root.txt"));

      await user.keyboard("{Home}");
      expect(item("dir")).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("dir"));
    });

    it("opens a closed directory with Right, without selecting or moving", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness onSelect={onSelect} />);

      focus("dir");
      await user.keyboard("{ArrowRight}");

      expect(item("dir")).toHaveAttribute("aria-expanded", "true");
      expect(item("dir")).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("moves to the first child with Right on an open directory", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness initiallyExpanded={["dir"]} onSelect={onSelect} />);

      focus("dir");
      await user.keyboard("{ArrowRight}");

      expect(item("dir/sub")).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("dir/sub"));
    });

    it("closes an open directory with Left, without selecting or moving", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness initiallyExpanded={["dir"]} onSelect={onSelect} />);

      focus("dir");
      await user.keyboard("{ArrowLeft}");

      expect(item("dir")).toHaveAttribute("aria-expanded", "false");
      expect(item("dir")).toHaveFocus();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("moves to the parent with Left on a node that isn't an open directory", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Harness initiallyExpanded={["dir"]} onSelect={onSelect} />);

      focus("dir/a.txt");
      await user.keyboard("{ArrowLeft}");

      expect(item("dir")).toHaveFocus();
      expect(onSelect).toHaveBeenLastCalledWith(selectedWith("dir"));
    });

    it("falls back to a visible item to tab to when the focused item's directory closes", async () => {
      const user = userEvent.setup();
      render(<Harness initiallyExpanded={["dir"]} />);

      await user.click(item("dir/a.txt"));
      await user.click(within(item("dir")).getByTestId("file-tree-toggle"));

      expect(queryItem("dir/a.txt")).toBeUndefined();
      expect(item("dir")).toHaveAttribute("tabindex", "0");
    });
  });

  describe("context menu", () => {
    it("tells which node a context menu is asked for on", () => {
      const onNodeContextMenu = vi.fn();
      render(<Harness onNodeContextMenu={onNodeContextMenu} />);

      fireEvent.contextMenu(item("root.txt"));

      expect(onNodeContextMenu).toHaveBeenCalledTimes(1);
      expect(onNodeContextMenu).toHaveBeenCalledWith(selectedWith("root.txt"), expect.anything());
    });

    it("leaves the browser's menu alone when nothing handles it", () => {
      render(<Harness />);

      // fireEvent returns false when the event was cancelled
      expect(fireEvent.contextMenu(item("root.txt"))).toBe(true);
    });

    it("lets the handler keep the browser's menu away", () => {
      render(<Harness onNodeContextMenu={(_node, event) => event.preventDefault()} />);

      expect(fireEvent.contextMenu(item("root.txt"))).toBe(false);
    });
  });

  describe("loading children", () => {
    const unloaded: IFileTreeNode[] = [{ path: relativePath("dir"), kind: "directory" }];

    const loaded: IFileTreeNode[] = [
      {
        path: relativePath("dir"),
        kind: "directory",
        children: [{ path: relativePath("dir/a.txt"), kind: "file" }],
      },
    ];

    const toggle = () => within(item("dir")).getByTestId("file-tree-toggle");

    it("asks for the children of an unloaded directory when it opens, and shows it's busy", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi.fn(() => new Promise<void>(() => {}));
      render(<Harness nodes={unloaded} onLoadChildren={onLoadChildren} />);

      await user.click(toggle());

      expect(onLoadChildren).toHaveBeenCalledTimes(1);
      expect(onLoadChildren).toHaveBeenCalledWith(unloaded[0]);
      expect(item("dir")).toHaveAttribute("aria-busy", "true");
    });

    it("shows the children once they're in nodes, and doesn't ask again", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi.fn(() => Promise.resolve());
      const { rerender } = render(<Harness nodes={unloaded} onLoadChildren={onLoadChildren} />);

      await user.click(toggle());
      await waitFor(() => expect(item("dir")).not.toHaveAttribute("aria-busy"));

      rerender(<Harness nodes={loaded} onLoadChildren={onLoadChildren} />);
      expect(visiblePaths()).toEqual(["dir", "dir/a.txt"]);

      await user.click(toggle());
      await user.click(toggle());

      expect(onLoadChildren).toHaveBeenCalledTimes(1);
    });

    it("doesn't ask while a load is already running", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi.fn(() => new Promise<void>(() => {}));
      render(<Harness nodes={unloaded} onLoadChildren={onLoadChildren} />);

      await user.click(toggle());
      await user.click(toggle());
      await user.click(toggle());

      expect(onLoadChildren).toHaveBeenCalledTimes(1);
    });

    it("tries again when a directory that failed to load is toggled", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error("unreadable"))
        .mockResolvedValue(undefined);
      render(<Harness nodes={unloaded} onLoadChildren={onLoadChildren} />);

      await user.click(toggle());
      await waitFor(() => expect(item("dir")).not.toHaveAttribute("aria-busy"));

      // Still open, rather than closed by the failure
      expect(item("dir")).toHaveAttribute("aria-expanded", "true");

      await user.click(toggle());

      expect(onLoadChildren).toHaveBeenCalledTimes(2);
    });

    it("explains a failed load in a tooltip over the error icon", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("nope"));
      render(
        <Harness
          loadErrorMessage="Failed to read directory"
          nodes={unloaded}
          onLoadChildren={onLoadChildren}
        />,
      );

      await user.click(toggle());
      await user.hover(await within(item("dir")).findByTestId("file-tree-error"));

      expect(await screen.findByRole("tooltip")).toHaveTextContent("Failed to read directory");
    });

    it("names the error icon for screen readers without a browser tooltip of its own", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("nope"));
      render(
        <Harness
          loadErrorMessage="Failed to read directory"
          nodes={unloaded}
          onLoadChildren={onLoadChildren}
        />,
      );

      await user.click(toggle());

      const icon = await within(item("dir")).findByRole("img", {
        name: "Failed to read directory",
      });
      expect(icon).not.toHaveAttribute("title");
    });

    it("has no tooltip for a failed load when it's given no message", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("nope"));
      render(<Harness nodes={unloaded} onLoadChildren={onLoadChildren} />);

      await user.click(toggle());
      await user.hover(await within(item("dir")).findByTestId("file-tree-error"));

      // longer than the tooltip takes to open
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("doesn't ask for the children of a directory that has them", async () => {
      const user = userEvent.setup();
      const onLoadChildren = vi.fn(() => Promise.resolve());
      render(<Harness nodes={loaded} onLoadChildren={onLoadChildren} />);

      await user.click(toggle());

      expect(onLoadChildren).not.toHaveBeenCalled();
    });
  });

  describe("virtualisation", () => {
    const MANY = buildFileTree(
      Array.from({ length: 200 }, (_, index) => ({
        path: relativePath(`f${String(index).padStart(3, "0")}.txt`),
        kind: "file" as const,
      })),
    );

    const first = "f000.txt";
    const last = "f199.txt";

    // jsdom has no layout: give the scroller a height, and the items a place in it.
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.dataset.testid === "scroller" ? 400 : 0;
        },
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const renderInScroller = () =>
      render(
        <div data-testid="scroller" style={{ overflowY: "auto" }}>
          <Harness nodes={MANY} />
        </div>,
      );

    const scrollTo = (top: number) => {
      const scroller = screen.getByTestId("scroller");
      Object.defineProperty(scroller, "scrollTop", { configurable: true, value: top });
      fireEvent.scroll(scroller);
    };

    it("renders only the items in view, telling how many there are", () => {
      renderInScroller();

      const items = screen.getAllByRole("treeitem");
      expect(items.length).toBeLessThan(40);
      expect(items[0]).toHaveAttribute("aria-setsize", "200");
      expect(queryItem(last)).toBeUndefined();
    });

    it("renders every item without a scrolling ancestor", () => {
      render(<Harness nodes={MANY} />);

      expect(screen.getAllByRole("treeitem")).toHaveLength(200);
    });

    it("moves focus to an item that wasn't rendered, and back", () => {
      renderInScroller();
      focus(first);

      fireEvent.keyDown(screen.getByRole("tree"), { key: "End" });
      expect(item(last)).toHaveFocus();

      fireEvent.keyDown(screen.getByRole("tree"), { key: "Home" });
      expect(item(first)).toHaveFocus();
    });

    it("keeps the item Tab moves to rendered when it's scrolled away", () => {
      renderInScroller();
      focus("f005.txt");
      act(() => item("f005.txt").blur());

      scrollTo(4000);

      expect(item("f005.txt")).toHaveAttribute("tabindex", "0");
      expect(queryItem("f006.txt")).toBeUndefined();
    });
  });
});
