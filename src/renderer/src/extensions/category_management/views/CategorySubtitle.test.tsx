import { render, screen } from "@testing-library/react";
import React from "react";
import type { TFunction } from "react-i18next";
import { describe, expect, it } from "vitest";

import CategorySubtitle from "./CategorySubtitle";

const renderComponent = ({
  category,
}: Pick<React.ComponentProps<typeof CategorySubtitle>, "category">) => {
  const t = ((key: string, vars?: Record<string, string | number>) => {
    if (!vars) return key;
    return key
      .replace("{{ count }}", String(vars.count ?? ""))
      .replace("{{ sub }}", String(vars.sub ?? ""))
      .replace("{{ nested }}", String(vars.nested ?? ""));
  }) as unknown as TFunction;

  render(<CategorySubtitle category={category} t={t} />);
  return { t };
};

const mockCategory = {
  title: "Category A",
  categoryId: "A",
  expanded: false,
  children: [],
  parentId: undefined,
  order: 0,
  nestedModCount: 0,
  subCategoryCount: 0,
  directModCount: 0,
};

describe("CategorySubtitle", () => {
  it("shows the correct direct mod count", () => {
    renderComponent({ category: { ...mockCategory, directModCount: 5 } });
    expect(screen.getByText("5 mod(s)")).toBeInTheDocument();
  });

  it("shows nested/subcategory counts", () => {
    renderComponent({
      category: {
        ...mockCategory,
        directModCount: 5,
        nestedModCount: 10,
        subCategoryCount: 1,
      },
    });
    expect(screen.getByText("5 mod(s) (1 sub-categories with 10 mod(s))")).toBeInTheDocument();
  });
});
