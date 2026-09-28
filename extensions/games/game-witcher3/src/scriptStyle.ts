/**
 * How a mod changes game scripts. Recorded as a mod attribute at install time,
 * so later checks read a value instead of the file system. Kept free of Vortex
 * API imports so it can be unit tested.
 */

export const W3ScriptStyle = {
  /** Ships no scripts. */
  None: "none",
  /** Every script declares its target with a scope annotation. */
  Annotation: "annotation",
  /** Ships at least one script that replaces a whole file. */
  Override: "override",
} as const;
export type W3ScriptStyle = (typeof W3ScriptStyle)[keyof typeof W3ScriptStyle];

/** Mod attribute the style is stored under. */
export const SCRIPT_STYLE_ATTRIBUTE = "w3ScriptStyle";

export const SCRIPT_EXTENSION = ".ws";

/**
 * Scope annotations name the class and function a mod changes, so two mods
 * using them never claim the same file and never need merging.
 */
const ANNOTATION = /@(wrapMethod|replaceMethod|addMethod|addField)\b/;

export const isScript = (filePath: string): boolean =>
  filePath.toLowerCase().endsWith(SCRIPT_EXTENSION);

export const isAnnotationScript = (contents: string): boolean =>
  contents !== undefined && ANNOTATION.test(contents);

/**
 * Classifies a mod from the scripts it ships. A single plain script makes the
 * whole mod an override, since that one file can collide with another mod's
 * copy whether or not the rest use annotations.
 */
export function classifyScripts(scripts: Array<{ contents: string }>): W3ScriptStyle {
  if (scripts.length === 0) {
    return W3ScriptStyle.None;
  }
  return scripts.every((script) => isAnnotationScript(script.contents))
    ? W3ScriptStyle.Annotation
    : W3ScriptStyle.Override;
}

/**
 * Whether a mod of this style can collide with another mod over a script file,
 * which is the only thing the script merger resolves.
 */
export const needsScriptMerger = (style: W3ScriptStyle): boolean =>
  style === W3ScriptStyle.Override;

/**
 * Style recorded against a mod. Anything unrecognised counts as an override,
 * since the attribute is only written at install time and a mod without one
 * could be either.
 */
export const styleOf = (attributeValue: unknown): W3ScriptStyle =>
  attributeValue === W3ScriptStyle.Annotation || attributeValue === W3ScriptStyle.None
    ? attributeValue
    : W3ScriptStyle.Override;

/**
 * Whether the script merger is worth suggesting. It has nothing to do until two
 * mods claim the same script. Reads recorded styles, never the file system.
 */
export function shouldSuggestScriptMerger(recordedStyles: unknown[]): boolean {
  let overrides = 0;
  for (const value of recordedStyles) {
    if (needsScriptMerger(styleOf(value)) && ++overrides > 1) {
      return true;
    }
  }
  return false;
}
