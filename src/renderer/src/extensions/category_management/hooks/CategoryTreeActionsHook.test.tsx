import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeCategory } from "@/test-utils/builders";
import { makeCategoryTreeActionsHarness } from "@/test-utils/categoryTreeHarness";

/**
 * State-integrity tests: every action the hook performs goes through the real
 * category reducer (see categoryTreeHarness.tsx), and the invariant under test
 * is that a category present in persisted state stays reachable in the rebuilt
 * tree - an unreachable category silently vanishes from the modal while
 * remaining in state, with no way for the user to recover it.
 */
describe("useCategoryTreeActions state integrity", () => {
  it("moveCategory into an unrelated category keeps every category visible (harness sanity check)", () => {
    const harness = makeCategoryTreeActionsHarness({
      a: makeCategory({ name: "A", order: 0 }),
      b: makeCategory({ name: "B", order: 1 }),
    });

    act(() => {
      harness.actions().moveCategory("b", "a", "inside");
    });

    expect(harness.getCategories().b.parentCategory).toBe("a");
    expect(harness.getVisibleIds()).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("moveCategory rejects dropping a category into its own descendant", () => {
    const harness = makeCategoryTreeActionsHarness({
      root: makeCategory({ name: "Root", order: 0 }),
      child: makeCategory({ name: "Child", parentCategory: "root", order: 1 }),
    });

    act(() => {
      harness.actions().moveCategory("root", "child", "inside");
    });

    // a parentCategory cycle makes both categories unreachable from the roots:
    // they vanish from the modal while persisting in state
    expect(harness.getVisibleIds()).toEqual(expect.arrayContaining(["root", "child"]));
    expect(harness.getCategories().root.parentCategory).not.toBe("child");
  });

  it("removeCategory does not leave orphaned descendants invisible in state", () => {
    const harness = makeCategoryTreeActionsHarness({
      root: makeCategory({ name: "Root", order: 0 }),
      child: makeCategory({ name: "Child", parentCategory: "root", order: 1 }),
      grandchild: makeCategory({ name: "Grandchild", parentCategory: "child", order: 2 }),
    });

    act(() => {
      harness.actions().removeCategory("root");
    });

    // descendants left pointing at a deleted id stay in state but can never be
    // displayed; whether they are removed with their parent or re-parented,
    // every category remaining in state must stay reachable in the tree
    const remaining = Object.keys(harness.getCategories());
    expect(harness.getVisibleIds()).toEqual(expect.arrayContaining(remaining));
  });
});
