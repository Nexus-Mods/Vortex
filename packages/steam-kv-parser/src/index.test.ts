/**
 * Behavior tests, transcribed from the reference implementation:
 * ValveKeyValue (https://github.com/ValveResourceFormat/ValveKeyValue)
 * test suite (KV1 text format only), plus real Steam data in ./testdata/.
 */
import { readFileSync } from "node:fs";

import { assert, describe, expect, test } from "vitest";

import { KVSyntaxError, parse, stringify, type KVBlock, type KVNode } from "./index";

const load = (name: string): string =>
  readFileSync(new URL(`./testdata/${name}`, import.meta.url), "utf8");

const keys = (node: KVBlock): string[] => node.children.map((c) => c.key);

const child = (parent: KVBlock, key: string): KVNode => {
  const found = parent.children.find((c) => c.key === key);
  assert(found !== undefined, `no child "${key}"`);
  return found;
};

const asBlock = (node: KVNode, what: string): KVBlock => {
  assert(node.type === "block", `${what} is not a block`);
  return node;
};

const leafOf = (node: KVNode): string => {
  assert(node.type === "leaf", `"${node.key}" is not a leaf`);
  return node.value;
};

const leaf = (parent: KVBlock, key: string): string => leafOf(child(parent, key));

describe("appmanifest (real steam file)", () => {
  const root = parse(load("appmanifest_262060.acf"));

  test("root key", () => {
    expect(root.key).toBe("AppState");
  });

  test("key order is file order", () => {
    expect(keys(root)).toEqual([
      "appid",
      "universe",
      "name",
      "StateFlags",
      "installdir",
      "LastUpdated",
      "LastPlayed",
      "SizeOnDisk",
      "StagingSize",
      "buildid",
      "LastOwner",
      "DownloadType",
      "UpdateResult",
      "BytesToDownload",
      "BytesDownloaded",
      "BytesToStage",
      "BytesStaged",
      "TargetBuildID",
      "AutoUpdateBehavior",
      "AllowOtherDownloadsWhileRunning",
      "ScheduledAutoUpdate",
      "InstalledDepots",
      "UserConfig",
      "MountedConfig",
    ]);
  });

  test("values are verbatim strings", () => {
    expect(leaf(root, "name")).toBe("Darkest Dungeon®");
    expect(leaf(root, "appid")).toBe("262060");
    expect(leaf(root, "SizeOnDisk")).toBe("4183238288");
    expect(leaf(root, "installdir")).toBe("DarkestDungeon");
  });

  test("depot key order is file order", () => {
    const depots = asBlock(child(root, "InstalledDepots"), "InstalledDepots");
    expect(keys(depots)).toEqual([
      "262065",
      "262066",
      "445702",
      "580102",
      "702542",
      "735732",
      "1117862",
    ]);
  });

  test("depot values", () => {
    const depots = asBlock(child(root, "InstalledDepots"), "InstalledDepots");
    expect(leaf(asBlock(child(depots, "262065"), "depot"), "manifest")).toBe("340638292043141637");
    expect(leaf(asBlock(child(depots, "445702"), "depot"), "dlcappid")).toBe("445700");
    expect(leaf(asBlock(child(depots, "735732"), "depot"), "size")).toBe("651754999");
  });
});

describe("inline blocks (from appmanifest InstalledDepots)", () => {
  const acf = `"AppState"
{
\t"appid"\t\t"489830"
\t"InstalledDepots"
\t{
\t\t"489831" { "manifest" "7997079406114800065" "size" "24638651277" }
\t\t"736261" { "manifest" "5847185504493819274" "size" "194838824" "dlcappid" "736260" }
\t}
\t"SharedDepots"
\t{
\t\t"228990"\t\t"228980"
\t}
\t"UserConfig"
\t{
\t\t"language"\t\t"english"
\t\t"BetaKey"\t\t"public"
\t}
\t"MountedConfig"
\t{
\t\t"language"\t\t"english"
\t\t"BetaKey"\t\t"public"
\t}
}`;
  const root = parse(acf);

  test("top-level order", () => {
    expect(keys(root)).toEqual([
      "appid",
      "InstalledDepots",
      "SharedDepots",
      "UserConfig",
      "MountedConfig",
    ]);
  });

  test("inline block on one line", () => {
    const depots = asBlock(child(root, "InstalledDepots"), "InstalledDepots");
    expect(keys(depots)).toEqual(["489831", "736261"]);
    const inlined = asBlock(child(depots, "736261"), "depot");
    expect(keys(inlined)).toEqual(["manifest", "size", "dlcappid"]);
    expect(leaf(inlined, "manifest")).toBe("5847185504493819274");
  });

  test("leaf-to-leaf mapping", () => {
    expect(leaf(asBlock(child(root, "SharedDepots"), "SharedDepots"), "228990")).toBe("228980");
  });
});

describe("assignment (ported: AssignmentTestCase)", () => {
  test.each([
    ['`"root" { key=value }`', '"root" { key=value }'],
    ['`"root" { key = value }`', '"root" { key = value }'],
    ['`"root" { "key" = "value" }`', '"root" { "key" = "value" }'],
    ['`"root" { "key"="value" }`', '"root" { "key"="value" }'],
    ['`"root" { key\\t=\\nvalue }`', '"root" { key\t=\nvalue }'],
    ["comment within", '"root" { key = // comment\nvalue }'],
    ['`"root" { key value}`', '"root" { key value}'],
    ['`"root"{key"value"}`', '"root"{key"value"}'],
  ])("%s", (_name, text) => {
    const root = parse(text);
    expect(root.key).toBe("root");
    expect(values(root)).toEqual([["key", "value"]]);
  });

  const values = (root: KVBlock): Array<[string, string]> =>
    root.children.map((c) => [c.key, leafOf(c)]);

  test("assignment then further pair", () => {
    const root = parse('"root" { key=value "b" "2" }');
    expect(values(root)).toEqual([
      ["key", "value"],
      ["b", "2"],
    ]);
  });

  test("assignments inside nested object", () => {
    const root = parse('"root" { "key" { a=1 b=2 } }');
    const nested = asBlock(child(root, "key"), "key");
    expect(values(nested)).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  test.each([
    ['`"root" { key = { a 1 } }`', '"root" { key = { a 1 } }'],
    ['`"root" { key={a=1} }`', '"root" { key={a=1} }'],
    ['`"root" { key{ a 1 } }`', '"root" { key{ a 1 } }'],
  ])("assignment before object: %s", (_name, text) => {
    const root = parse(text);
    const nested = asBlock(child(root, "key"), "key");
    expect(values(nested)).toEqual([["a", "1"]]);
  });

  test("quoted special characters are literal", () => {
    const root = parse('"root" { "a" "x=y{}" "=" "{" "b" "=" }');
    expect(values(root)).toEqual([
      ["a", "x=y{}"],
      ["=", "{"],
      ["b", "="],
    ]);
  });

  test("only the first = is an assignment", () => {
    const root = parse('"root" { a=1=2 key value=x }');
    expect(values(root)).toEqual([
      ["a", "1"],
      ["=", "2"],
      ["key", "value"],
      ["=", "x"],
    ]);
  });

  test.each([
    ["after the root key", '"root" = { a 1 }', "Found '=' after the root key at line 1, column 8"],
    [
      "after assignment",
      '"root" { a = }',
      "Attempted to finalize object while in state InObjectAfterAssignment at line 1, column 14",
    ],
    [
      "consecutive",
      '"root" { a = = b }',
      "Attempted to finalize object while in state InObjectBetweenKeyAndValue at line 1, column 18",
    ],
  ])("invalid assignment (%s) throws", (_name, text, message) => {
    expect(() => parse(text)).toThrow(KVSyntaxError);
    expect(() => parse(text)).toThrow(message);
  });
});

describe("malformed documents (ported: MalformedSyntaxTestCase, KV1)", () => {
  test.each([
    ["missing value", '"a" { "b" }'],
    ["unterminated object", '"a" { "b" {'],
    ["object without key", '"a" { {'],
    ["root without value", '"a"'],
    ["empty document", ""],
    ["whitespace only", "   \n  "],
  ])("%s throws", (_name, text) => {
    expect(() => parse(text)).toThrow(KVSyntaxError);
  });

  test("'=' as document root", () => {
    expect(() => parse('"a" = "y"')).toThrow("the root key must be followed by '{'");
  });

  test("scalar document root is a root key without '{'", () => {
    expect(() => parse('"a" "1"')).toThrow("the root key must be followed by '{'");
  });
});

describe("single root only (ported: MultipleRootObjectsTestCase)", () => {
  test.each([
    ["fixture", load("multiple_root_objects.vdf"), "line 6, column 1"],
    ["second top-level pair", '"a"\t"1"\n"b"\t"2"', "line 2, column 1"],
    ["stray closing brace", '"a"\n{\n}\n}', "line 4, column 1"],
  ])("%s throws", (_name, text, position) => {
    expect(() => parse(text)).toThrow(KVSyntaxError);
    expect(() => parse(text)).toThrow(position);
  });
});

describe("comments", () => {
  test("comment on its own line (ported: CommentOnEndOfTheLine)", () => {
    const root = parse('"test_kv"\n{\n//\n"test"\t"hello"\n}\n');
    expect(root.key).toBe("test_kv");
    expect(keys(root)).toEqual(["test"]);
    expect(leaf(root, "test")).toBe("hello");
  });

  test("trailing comment", () => {
    const root = parse('"root" { "a" "1" // comment\n "b" "2" }');
    expect(values(root)).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  test("a single slash starts a comment (Tier1 bug compatibility)", () => {
    const root = parse('"root" { "a" "1" / junk comment\n "b" "2" }');
    expect(values(root)).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  test("comment ends at line break", () => {
    const root = parse('"root" { "a" "1" // }\n}');
    expect(values(root)).toEqual([["a", "1"]]);
  });

  const values = (root: KVBlock): Array<[string, string]> =>
    root.children.map((c) => [c.key, leafOf(c)]);
});

describe("inclusions are rejected", () => {
  test.each([
    ["#base", '"root" { }\n#base "other.vdf"'],
    ["#include", '"root" { }\n#include "other.vdf"'],
  ])("%s throws", (_name, text) => {
    expect(() => parse(text)).toThrow(KVSyntaxError);
    expect(() => parse(text)).toThrow(/inclusion/i);
  });
});

describe("escape sequences: disabled (default)", () => {
  test("invalid escapes are literal garbage (ported: EscapedGarbageTestCase)", () => {
    const root = parse(load("escaped_garbage.vdf"));
    expect(leaf(root, "key")).toBe("abcd\\7efg");
  });

  test("backslashes are literal (ported: EscapedBackslashTestCase, no escapes)", () => {
    const root = parse(load("escaped_backslash.vdf"));
    expect(leaf(root, "key")).toBe("back\\\\slash");
    expect(leaf(root, "edge case")).toBe("this is fun\\\\");
  });

  test("trailing backslash before closing quote (ported: EscapedBackslashNoEscapeTestCase)", () => {
    const root = parse(load("escaped_backslash_single_slash.vdf"));
    expect(leaf(root, "BuildOutput")).toBe("..\\output\\");
  });

  test('stray \\\\" then a syntax error hints at the option', () => {
    expect(() => parse('"root" { "a" "x\\" b }')).toThrow(KVSyntaxError);
    expect(() => parse('"root" { "a" "x\\" b }')).toThrow(/escape sequences are disabled/);
  });
});

describe("escape sequences: enabled", () => {
  const options = { escapes: true };

  test("valid escapes decode (ported: EscapedWhitespaceTestCase)", () => {
    const root = parse(load("escaped_whitespace.vdf"), options);
    expect(leaf(root, "key")).toBe("line1\nline2\tline2pt2");
  });

  test("backslash decodes", () => {
    const root = parse(load("escaped_backslash.vdf"), options);
    expect(leaf(root, "key")).toBe("back\\slash");
    expect(leaf(root, "edge case")).toBe("this is fun\\");
  });

  test('quoted string ends at \\\\\\" (ported: EscapedEndingQuoteTestCase)', () => {
    const root = parse(load("escaped_ending_quote.vdf"), options);
    expect(leaf(root, "key")).toBe('some value"');
    expect(leaf(root, "foo")).toBe("bar");
  });

  test("quotes in keys and values (ported: EscapedQuotationMarksTestCase)", () => {
    const root = parse(load("escaped_quotation_marks.vdf"), options);
    expect(root.children).toEqual([
      { type: "leaf", key: 'name "of" key', value: 'value "of" key' },
    ]);
  });

  test("unknown escape throws at the backslash (ported: EscapedGarbageTestCase)", () => {
    expect(() => parse(load("escaped_garbage.vdf"), options)).toThrow(KVSyntaxError);
    expect(() => parse(load("escaped_garbage.vdf"), options)).toThrow(
      "Unknown escape sequence '\\7' at line 3, column 14",
    );
  });

  test("unquoted values never process escapes", () => {
    const root = parse('"root" { QuotedChild edge\\ncase }', options);
    expect(leaf(root, "QuotedChild")).toBe("edge\\ncase");
  });
});

describe("unquoted tokens (ported: UnquotedTextTestCase)", () => {
  const root = parse(load("unquoted_document.vdf"));

  test("root key", () => {
    expect(root.key).toBe("TestDocument");
  });

  test("unquoted value keeps escapes literal", () => {
    expect(leaf(root, "QuotedChild")).toBe("edge\\ncase");
  });

  test("mixed quoting of pairs", () => {
    const nested = asBlock(child(root, "UnquotedChild"), "UnquotedChild");
    expect(leaf(nested, "Key1")).toBe("Value1");
    expect(leaf(nested, "Key2")).toBe("Value2");
    expect(leaf(nested, "Key3")).toBe("Value3");
  });
});

describe("real TF2 appinfo (ported: SteamDataTestCase, bug-for-bug)", () => {
  const root = parse(load("steam_440.vdf"));
  const config = asBlock(child(root, "config"), "config");

  test("BOM and CRLF are tolerated", () => {
    expect(root.key).toBe("appinfo");
  });

  test("cleanupcmds keeps the literal trailing backslash", () => {
    expect(leaf(config, "cleanupcmds")).toBe("if not exist hl2.exe goto EOF;ren \\");
  });

  test("unescaped inner quotes split the value (Tier1 bug compatibility)", () => {
    expect(leaf(config, "..\\..\\common\\Team")).toBe("Fortress");
    expect(leaf(config, "2\\")).toBe(
      " TF2_bak;del /q /s bin\\*;cd tf;del /q /s *.cache media\\*.mov;mkdir download;cd download;move ..\\maps .\\;move ..\\materials .\\;" +
        "move ..\\models .\\;move ..\\particles .\\;move ..\\resource .\\;move ..\\sound .\\;move ..\\scripts .\\;cd resource;" +
        "del game.ico tf.ttf tf2.ttf tf2build.ttf tf2professor.ttf tf2secondary.ttf tfd.ttf;cd ..\\sound\\ui;" +
        "del gamestartup*.mp3 tv_tune*.mp3 holiday\\gamestartup_*.mp3;:EOF",
    );
  });

  test("deep nesting", () => {
    const launch = asBlock(child(asBlock(child(config, "launch"), "launch"), "2"), "launch[2]");
    expect(leaf(launch, "executable")).toBe("hl2.sh");
    expect(leaf(asBlock(child(launch, "config"), "launch[2].config"), "oslist")).toBe("linux");
  });
});

describe("stringify round trip", () => {
  test("parse > stringify > parse is identical", () => {
    const root = parse(load("appmanifest_262060.acf"));
    const roundTripped = parse(stringify(root, { pretty: true }));
    expect(roundTripped).toEqual(root);
  });

  test("escapes survive the round trip", () => {
    const root = parse(load("escaped_quotation_marks.vdf"), { escapes: true });
    const roundTripped = parse(stringify(root, { escapes: true }), { escapes: true });
    expect(roundTripped).toEqual(root);
  });

  test("values that need escapes cannot be written without escaping", () => {
    const root = parse('"root" { "a" "\\n" }', { escapes: true });
    expect(() => stringify(root, { escapes: false })).toThrow(/escape sequences/);
  });

  test("pretty output is tab indented", () => {
    const output = stringify(parse('"root" { "a" "1" "b" { "c" "2" } }'), { pretty: true });
    expect(output).toContain('"a"\t\t"1"');
    expect(output).toContain('\t\t{\n\t\t\t"c"\t\t"2"\n\t\t}');
  });
});
