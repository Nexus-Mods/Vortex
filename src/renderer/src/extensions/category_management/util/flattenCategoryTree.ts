import type { ICategoriesTreeEntry } from "../types/ICategoriesTreeEntry";

/**
 * Takes the category tree and flattems it out into a single array of the IDs
 * Recursively collects IDs from all nested children.
 * @param {ICategoriesTreeEntry[]} nodes:ICategoriesTreeEntry[]
 * @returns {string[]}
 */
const flattenTreeToIDs = (nodes: ICategoriesTreeEntry[]): string[] =>
  nodes.flatMap((node) => [node.categoryId, ...flattenTreeToIDs(node.children)]);

export { flattenTreeToIDs };
