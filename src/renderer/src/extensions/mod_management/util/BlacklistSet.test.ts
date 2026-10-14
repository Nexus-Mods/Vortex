import * as path from "node:path";

import { expect, test } from "vitest";

import type { IGame } from "../../../types/IGame";
import BlacklistSet from "./BlacklistSet";

// a case-sensitive volume's normalize, where nocase is what matches across case
const normalize = (input: string) => input;
const gameWith = (ignoreDeploy?: string[]) => ({ details: { ignoreDeploy } }) as unknown as IGame;
const staged = (...segments: string[]) => path.join("SomeMod", ...segments);

test("skips the built-in patterns in any case", () => {
  const blacklist = new BlacklistSet([], gameWith(), normalize);

  expect(blacklist.has(staged(".Git", "config"))).toBe(true);
  expect(blacklist.has(staged("textures", "META.INI"))).toBe(true);
  expect(blacklist.has(staged("__macosx", "Thumbs.db"))).toBe(true);
  expect(blacklist.has(staged("textures", "armor.dds"))).toBe(false);
});

test("skips dot-prefixed files and folders the patterns cover", () => {
  const blacklist = new BlacklistSet([], gameWith(), normalize);

  expect(blacklist.has(staged("__MACOSX", "._armor.dds"))).toBe(true);
  expect(blacklist.has(staged(".hidden", "meta.ini"))).toBe(true);
});

test("skips the game's own patterns and the exact entries it was given", () => {
  const blacklist = new BlacklistSet(
    [staged("readme.txt")],
    gameWith([path.join("**", "info.json")]),
    normalize,
  );

  expect(blacklist.has(staged("mods", "x", "info.json"))).toBe(true);
  expect(blacklist.has(staged("readme.txt"))).toBe(true);
  expect(blacklist.has(staged("mods", "x", "other.json"))).toBe(false);
});

test("a pattern that cannot be compiled leaves the other patterns working", () => {
  const blacklist = new BlacklistSet([], gameWith([123 as unknown as string]), normalize);

  expect(blacklist.has(staged("meta.ini"))).toBe(true);
});
