import type { ITableAttribute } from "../../types/ITableAttribute";

/**
 * Collects the attributes extensions register for a table, by its id. The legacy table and
 * the new Mods table both take them through it: the extension API finds it by its name, so
 * it keeps the name of the `registerTableAttribute` call it answers.
 */
export function registerTableAttribute(
  instanceGroup: string,
  group: string,
  attribute: ITableAttribute,
): ITableAttribute | undefined {
  return instanceGroup === group ? attribute : undefined;
}
