/**
 * Reads the phases of one deployment out of the fixture's vortex.log.
 *
 * Deployment reports each step as a "deployment progress" line (see genUpdateModDeployment in
 * src/renderer/src/extensions/mod_management/index.ts). The time from one step's line to the
 * next is that step's duration; the last step runs until the deploy finished.
 */
import fs from "node:fs";

export interface IDeployPhase {
  name: string;
  ms: number;
}

export interface IDeployLog {
  phases: IDeployPhase[];
  filesAdded: number;
  filesRemoved: number;
}

const LINE = /^(\d{4}-\d\d-\d\dT[\d:.]+Z) \[\w+\] \[RENDERER\] (.*)$/;
const PROGRESS = /^deployment progress \{"text":"((?:[^"\\]|\\.)*)"/;
const COUNTS = /^deployment \{"added":(\d+),"removed":(\d+)/;

/** per-mod and per-file progress lines collapse into one phase each */
function phaseName(text: string): string {
  if (/^Deploying: \d+\/\d+ files$/.test(text)) {
    return "Writing files";
  }
  if (text.startsWith("Deploying: ")) {
    return "Linking mods";
  }
  return text;
}

export function readDeployLog(logFile: string, fromMs: number, toMs: number): IDeployLog {
  const result: IDeployLog = { phases: [], filesAdded: 0, filesRemoved: 0 };
  if (!fs.existsSync(logFile)) {
    return result;
  }
  const marks: Array<{ name: string; at: number }> = [];
  for (const line of fs.readFileSync(logFile, "utf8").split(/\r?\n/)) {
    const [, stamp = "", message = ""] = LINE.exec(line) ?? [];
    const at = Date.parse(stamp);
    if (Number.isNaN(at) || at < fromMs || at > toMs) {
      continue;
    }
    const [, text] = PROGRESS.exec(message) ?? [];
    if (text !== undefined) {
      const name = phaseName(text);
      if (marks.at(-1)?.name !== name) {
        marks.push({ name, at });
      }
      continue;
    }
    const [, added, removed] = COUNTS.exec(message) ?? [];
    result.filesAdded += Number(added ?? 0);
    result.filesRemoved += Number(removed ?? 0);
  }
  result.phases = marks.map((mark, index) => ({
    name: mark.name,
    ms: (marks[index + 1]?.at ?? toMs) - mark.at,
  }));
  return result;
}
