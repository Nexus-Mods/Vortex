import { describe, expect, it } from "vitest";

import {
  classifyScripts,
  isAnnotationScript,
  isScript,
  needsScriptMerger,
  shouldSuggestScriptMerger,
  styleOf,
  W3ScriptStyle,
} from "./scriptStyle";

const WRAPPER = `
@wrapMethod(W3LevelManager)
function AddPoints(type : ESpendablePointType, amount : int, show : bool)
{
	wrappedMethod(type, amount * 5, show);
}
`;

const WHOLE_FILE = `
class W3LevelManager
{
	public function AddPoints(type : ESpendablePointType, amount : int, show : bool)
	{
		points[type].free += amount;
	}
}
`;

describe("isScript", () => {
  it.each(["a/b/foo.ws", "FOO.WS"])("recognises %s", (path) => {
    expect(isScript(path)).toBe(true);
  });

  it.each(["foo.xml", "blob0.bundle", "readme.txt"])("ignores %s", (path) => {
    expect(isScript(path)).toBe(false);
  });
});

describe("isAnnotationScript", () => {
  it.each(["@wrapMethod", "@replaceMethod", "@addMethod", "@addField"])(
    "recognises %s",
    (annotation) => {
      expect(isAnnotationScript(`${annotation}(W3PlayerWitcher)\nfunction Foo() {}`)).toBe(true);
    },
  );

  it("does not match a whole file copy", () => {
    expect(isAnnotationScript(WHOLE_FILE)).toBe(false);
  });

  it("does not match a name that merely starts the same", () => {
    expect(isAnnotationScript("@wrapMethodology(X)")).toBe(false);
  });
});

describe("classifyScripts", () => {
  it("reports no scripts for a mod that ships none", () => {
    expect(classifyScripts([])).toBe(W3ScriptStyle.None);
  });

  it("reports annotation when every script declares its target", () => {
    expect(classifyScripts([{ contents: WRAPPER }, { contents: WRAPPER }])).toBe(
      W3ScriptStyle.Annotation,
    );
  });

  it("reports override for a whole file copy", () => {
    expect(classifyScripts([{ contents: WHOLE_FILE }])).toBe(W3ScriptStyle.Override);
  });

  it("reports override when a mod mixes both", () => {
    // The plain file can still collide with another mod's copy of it.
    expect(classifyScripts([{ contents: WRAPPER }, { contents: WHOLE_FILE }])).toBe(
      W3ScriptStyle.Override,
    );
  });
});

describe("needsScriptMerger", () => {
  it("is true only for mods shipping a whole file copy", () => {
    expect(needsScriptMerger(W3ScriptStyle.Override)).toBe(true);
    expect(needsScriptMerger(W3ScriptStyle.Annotation)).toBe(false);
    expect(needsScriptMerger(W3ScriptStyle.None)).toBe(false);
  });
});

describe("styleOf", () => {
  it.each([W3ScriptStyle.Annotation, W3ScriptStyle.None, W3ScriptStyle.Override])(
    "keeps a recorded style of %s",
    (style) => {
      expect(styleOf(style)).toBe(style);
    },
  );

  it.each([undefined, null, "", "nonsense", 7])("treats %s as an override", (value) => {
    // Mods installed before the attribute existed carry no style.
    expect(styleOf(value)).toBe(W3ScriptStyle.Override);
  });
});

describe("shouldSuggestScriptMerger", () => {
  it("stays quiet for a single override mod", () => {
    // Nothing to merge until a second mod claims the same script.
    expect(shouldSuggestScriptMerger([W3ScriptStyle.Override])).toBe(false);
  });

  it("suggests it once two override mods are present", () => {
    expect(shouldSuggestScriptMerger([W3ScriptStyle.Override, W3ScriptStyle.Override])).toBe(true);
  });

  it("ignores annotation and script-free mods", () => {
    expect(
      shouldSuggestScriptMerger([
        W3ScriptStyle.Annotation,
        W3ScriptStyle.Annotation,
        W3ScriptStyle.None,
        W3ScriptStyle.Override,
      ]),
    ).toBe(false);
  });

  it("stays quiet when nothing is installed", () => {
    expect(shouldSuggestScriptMerger([])).toBe(false);
  });

  it("counts mods that predate the attribute", () => {
    expect(shouldSuggestScriptMerger([undefined, undefined])).toBe(true);
  });
});
