import * as React from "react";

/** Whether a piece of content is only blank space or a line break. */
const isBlank = (node: unknown) =>
  (typeof node === "string" && !node.trim()) || (React.isValidElement(node) && node.type === "br");

/** The content from its first piece that isn't blank, so it doesn't open on empty lines. */
export const withoutLeadingBlanks = (nodes: unknown[]) => {
  const start = nodes.findIndex((node) => !isBlank(node));

  if (start === -1) {
    return [];
  }

  return nodes.slice(start);
};

/** The content without the blank pieces it starts or ends with. */
export const withoutOuterBlanks = (nodes: unknown[]) =>
  withoutLeadingBlanks(withoutLeadingBlanks(nodes).reverse()).reverse();
