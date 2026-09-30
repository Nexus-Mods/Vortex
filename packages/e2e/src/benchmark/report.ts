/**
 * Renders a benchmark result as Markdown for pasting into a ticket or PR.
 */
import type { IBenchmarkResult } from "./collectionBenchmark";
import { median } from "./stats";

const ms = (value: number) => `${Math.round(value).toLocaleString("en-GB")} ms`;
const s = (value: number) => `${(value / 1000).toFixed(1)} s`;

function fixtureLine(fixture: Record<string, unknown>): string {
  const get = (key: string) => {
    const value = fixture[key];
    return typeof value === "string" || typeof value === "number" ? String(value) : "?";
  };
  const tier = fixture.tier === undefined ? "custom size" : `${get("tier")} tier`;
  return (
    `${get("game")}, ${tier}: ${get("members")} collection mods and ${get("library")} others, ` +
    `${get("enabled")} enabled`
  );
}

function deployPhases(result: IBenchmarkResult): string[] {
  const full = result.deploys.filter((run) => run.kind === "full");
  const names = [...new Set(full.flatMap((run) => run.log.phases.map((phase) => phase.name)))];
  if (names.length === 0) {
    return [];
  }
  const rows = names.map((name) => {
    const times = full.map((run) => run.log.phases.find((phase) => phase.name === name)?.ms ?? 0);
    return `| ${name} | ${ms(median(times))} |`;
  });
  return ["", "Full deploy by step, median:", "", "| Step | Time |", "| --- | --- |", ...rows];
}

function deploySection(result: IBenchmarkResult): string[] {
  const rows = result.deploys.map((run, index) => {
    const files = run.kind === "purge" ? "" : `${run.log.filesAdded}`;
    return (
      `| ${index + 1} | ${run.kind} | ${ms(run.ms)} | ${files} | ${ms(run.ui.longTaskMs)} | ` +
      `${ms(run.ui.worstFrameMs)} |`
    );
  });
  return [
    "## Deployment",
    "",
    `Full deploy median: **${s(result.deploySummary.fullMedianMs)}**. ` +
      `Purge median: ${s(result.deploySummary.purgeMedianMs)}. ` +
      `Deploy with nothing to change: ${s(result.deploySummary.incrementalMs)}.`,
    "",
    "| # | Run | Time | Files linked | UI blocked | Worst frame |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    ...deployPhases(result),
  ];
}

function scenarioSection(result: IBenchmarkResult): string[] {
  const rows = result.scenarios.map(
    (scenario) =>
      `| ${scenario.name} | ${scenario.settled ? ms(scenario.settleMs) : "did not settle"} | ` +
      `${ms(scenario.worstInputMs)} | ${ms(scenario.longTaskMs)} | ${ms(scenario.worstFrameMs)} | ` +
      `${scenario.jankFrames} |`,
  );
  return [
    "## Responsiveness",
    "",
    "| Action | Settled after | Worst input delay | UI blocked | Worst frame | Stutters |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `While the ${result.otherPage} page was showing, the hidden Mods page still had ` +
      `**${result.hiddenModsRows}** table rows in the page.`,
  ];
}

export function renderReport(result: IBenchmarkResult): string {
  const title =
    result.label === undefined ? "Collection benchmark" : `Collection benchmark: ${result.label}`;
  const lines = [
    `# ${title}`,
    "",
    `- **Fixture:** ${fixtureLine(result.fixture)}`,
    `- **Build:** ${result.branch} at ${result.commit}${result.dirty ? " with local changes" : ""}`,
    `- **Machine:** ${result.machine.cpu}, ${result.machine.cores} threads, ` +
      `${result.machine.memoryGb} GB, ${result.machine.os}`,
    `- **Run:** ${result.startedAt}${result.headless ? ", headless (frame timings not meaningful)" : ""}`,
    `- **Startup:** window after ${s(result.startup.windowMs)}, Mods page ready after ` +
      `${s(result.startup.modsReadyMs)}`,
    "",
    ...deploySection(result),
    "",
    ...scenarioSection(result),
    "",
    "Settled after: time until the page stopped changing. Worst input delay: longest time from " +
      "a click or key press to the next paint. UI blocked: total time the main thread ran tasks " +
      "over 50 ms. Stutters: frames over 50 ms.",
    "",
  ];
  return lines.join("\n");
}
