/* eslint-disable */
import memoize from "memoize-one";
import { types } from "vortex-api";

export const topologicalSort = memoize((graph: types.IMod[]): string[] => {
  const visited = new Set();
  const result: string[] = [];

  const visit = (modId: string, ruleType?: string) => {
    if (visited.has(modId)) {
      return;
    }

    visited.add(modId);

    const mod = graph.find((iter) => iter.id === modId)!;
    const rules =
      mod.rules?.filter(
        (rule) =>
          ["before", "after"].includes(rule.type) &&
          graph.find((mod) => mod.id === rule.reference.id),
      ) ?? [];

    rules.forEach((rule: types.IModRule) => {
      if (rule.type === "after") {
        visit(rule.reference.id as string, rule.type);
      }
    });
    result.push(modId);
  };

  graph.forEach((mod) => {
    visit(mod.id);
  });

  return result.reverse();
});
