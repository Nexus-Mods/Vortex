import { APP_DISPLAY_NAME, APP_STATE_DIR } from "./branding";

/**
 * Replaces the name "Vortex" with the mkeiitmods name in text shown to the user.
 *
 * Vortex uses its English UI strings as translation keys, and community language
 * packs are looked up by those keys. Rewriting the ~1400 source strings would
 * break every language pack and turn each upstream merge into a conflict, so the
 * name is swapped when the text is displayed instead.
 *
 * Mentions that really mean the upstream project are kept: credits
 * ("based on Vortex"), the Vortex documentation, and anything that is part of a
 * URL, path, identifier or package name (`vortex-api`, `Nexus-Mods/Vortex`,
 * `Vortex.exe`).
 */

const KEEP: readonly RegExp[] = [
  /based on Vortex/gi,
  /основан[аоы]? на Vortex/gi,
  /Vortex \(Nexus Mods\)/g,
  /Vortex [Ww]iki/g,
  /Vortex\.exe/g,
];

// "Vortex" as a whole word that isn't glued to a path, URL or identifier
const NAME = /(?<![\w/\\@.-])Vortex(?![\w/\\@-]|\.\w)/g;

const PLACEHOLDER = "\u0000";

export function rebrandText(text: string): string {
  if (typeof text !== "string" || !text.includes("Vortex")) {
    return text;
  }

  const kept: string[] = [];
  let result = text;
  for (const pattern of KEEP) {
    result = result.replace(pattern, (match) => {
      kept.push(match);
      return `${PLACEHOLDER}${kept.length - 1}${PLACEHOLDER}`;
    });
  }

  result = result.replace(NAME, APP_DISPLAY_NAME);
  // help texts show the data folder, which is ours now: AppData\Roaming\Vortex\...
  result = result.replace(/(AppData\\+Roaming\\+)Vortex(?=\\)/gi, `$1${APP_STATE_DIR}`);

  return result.replace(
    new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, "g"),
    (_match, idx: string) => kept[Number(idx)]!,
  );
}
