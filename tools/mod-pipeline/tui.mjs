/**
 * This file was written entirely by AI. Needs replacing once a proper implementation is available.
 *
 * A terminal screen for the fake Skyrim SE tool: shows whether the setup and its Vortex are there,
 * runs the tool's commands on a key press and shows what they print.
 *
 * Its dependencies come with the workspace's `pnpm install`. From a terminal:
 *   node tools/mod-pipeline/tui.mjs [--root dir] [--port 9222]
 * The options go to every command it runs. Without a terminal that reads keys it draws the screen
 * once and ends; the commands of fake-skyrimse.mjs work without it.
 */

import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { Box, Text, render, useApp, useInput, useStdin, useStdout } from "ink";
import { createElement as h, useEffect, useRef, useState } from "react";

import { describeJournal, keptJournals, status as readStatus } from "./fake-skyrimse.mjs";

const toolPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fake-skyrimse.mjs");
const passedOptions = process.argv.slice(2);

const ACTIONS = [
  { key: "s", label: "set up fresh and start Vortex", args: ["setup"] },
  { key: "t", label: "tamper with the deployed files", args: ["tamper"] },
  { key: "r", label: "prove a rollback", args: ["rollback"] },
  { key: "m", label: "prove the manifests", args: ["manifests"] },
  { key: "x", label: "delete the setup", args: ["setup", "--reset"] },
];

const STATUS_EVERY_MS = 2000;
const LOG_LINES_KEPT = 500;
const HEADER_ROWS = 3;
// a failed check's problems shown under it; the rest are in the output
const PROBLEMS_SHOWN = 3;

// a command's states and, as fake-skyrimse.mjs sends them, a check's
const RunState = { Running: "running", Passed: "passed", Failed: "failed" };
const CHECK_MARK = {
  [RunState.Running]: "…",
  [RunState.Passed]: "✓",
  [RunState.Failed]: "✗",
};
const RUN_COLOR = {
  [RunState.Running]: "cyan",
  [RunState.Passed]: "green",
  [RunState.Failed]: "red",
};

const secondsBetween = (from, to) => ((to - from) / 1000).toFixed(1);

/** The setup's state, read again every two seconds. */
function useStatus() {
  const [status, setStatus] = useState();
  useEffect(() => {
    let isCurrent = true;
    const read = () =>
      readStatus().then(
        (latest) => {
          // an unchanged status keeps its object, so the screen isn't redrawn
          if (isCurrent) {
            setStatus((known) =>
              JSON.stringify(known) === JSON.stringify(latest) ? known : latest,
            );
          }
        },
        // the setup can be mid-deletion; the next read tells
        () => undefined,
      );
    void read();
    const timer = setInterval(read, STATUS_EVERY_MS);
    return () => {
      isCurrent = false;
      clearInterval(timer);
    };
  }, []);
  return status;
}

/**
 * Runs one of the tool's commands at a time, keeping what it prints, the checks it reports over
 * the process channel and how it ended.
 */
function useCommand() {
  const [run, setRun] = useState();
  const [lines, setLines] = useState([]);
  const [checks, setChecks] = useState([]);
  const child = useRef();

  const start = (action) => {
    if (child.current !== undefined) {
      return;
    }
    const startedAt = Date.now();
    setLines([]);
    setChecks([]);
    setRun({ action, state: RunState.Running, startedAt });
    const running = spawn(process.execPath, [toolPath, ...action.args, ...passedOptions], {
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    child.current = running;
    running.on("message", (message) => {
      if (message?.type === "check") {
        setChecks((known) =>
          known.some(({ name }) => name === message.name)
            ? known.map((check) => (check.name === message.name ? message : check))
            : [...known, message],
        );
      }
    });
    let unfinishedLine = "";
    const keep = (chunk) => {
      const printed = (unfinishedLine + chunk.toString("utf8")).split(/\r?\n/);
      unfinishedLine = printed.pop() ?? "";
      setLines((kept) => [...kept, ...printed].slice(-LOG_LINES_KEPT));
    };
    running.stdout.on("data", keep);
    running.stderr.on("data", keep);
    running.on("close", (exitCode) => {
      child.current = undefined;
      if (unfinishedLine !== "") {
        setLines((kept) => [...kept, unfinishedLine]);
      }
      setRun({
        action,
        state: exitCode === 0 ? RunState.Passed : RunState.Failed,
        exitCode,
        startedAt,
        endedAt: Date.now(),
      });
    });
  };

  useEffect(() => () => child.current?.kill(), []);
  return { run, lines, checks, start };
}

/** The current time, updated every second while `isTicking`. */
function useClock(isTicking) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isTicking) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isTicking]);
  return now;
}

function Keys({ isBusy, onAction, onJournals }) {
  const { exit } = useApp();
  useInput((input) => {
    if (input === "q") {
      exit();
      return;
    }
    if (input === "j") {
      onJournals();
      return;
    }
    const action = ACTIONS.find(({ key }) => key === input);
    if (action !== undefined && !isBusy) {
      onAction(action);
    }
  });
  return null;
}

/** Opens a file in VS Code and tells `onResult` how that went. */
function openInVsCode(filePath, onResult) {
  const opening = spawn(`code "${filePath}"`, { shell: true, stdio: "ignore" });
  opening.on("error", () => onResult("couldn't run `code`"));
  opening.on("close", (exitCode) =>
    onResult(exitCode === 0 ? "opened in VS Code" : "couldn't run `code`; is it on the PATH?"),
  );
}

const OUTCOME_COLOR = {
  applied: "green",
  "rolled back": "yellow",
  unfinished: "red",
  "rollback stopped": "red",
};
const STEP_COLOR = { done: "green", undone: "yellow", started: "cyan" };

/** The Apply runs' journals, one at a time, the newest shown first. */
function Journals({ rows, onClose }) {
  const { exit } = useApp();
  const [journalFiles, setJournalFiles] = useState();
  const [shownIndex, setShownIndex] = useState(0);
  const [described, setJournal] = useState();
  const [firstRow, setFirstRow] = useState(0);
  const [note, setNote] = useState("");
  const shownFile = journalFiles?.[shownIndex];
  // the last journal read, until the shown one has been
  const journal = described?.file === shownFile ? described : undefined;
  const shownRows = Math.max(rows, 3);
  const operationCount = journal?.operations?.length ?? 0;

  useEffect(() => {
    let isCurrent = true;
    void keptJournals().then(
      (found) => {
        if (isCurrent) {
          setJournalFiles(found);
          setShownIndex(Math.max(found.length - 1, 0));
        }
      },
      () => isCurrent && setJournalFiles([]),
    );
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (shownFile === undefined) {
      return undefined;
    }
    let isCurrent = true;
    void describeJournal(shownFile).then(
      (described) => isCurrent && setJournal(described),
      (err) => isCurrent && setJournal({ file: shownFile, error: err.message }),
    );
    return () => {
      isCurrent = false;
    };
  }, [shownFile]);

  const show = (index) => {
    if (journalFiles !== undefined && index >= 0 && index < journalFiles.length) {
      setShownIndex(index);
      setFirstRow(0);
      setNote("");
    }
  };
  const scrollBy = (count) =>
    setFirstRow((row) => Math.max(0, Math.min(row + count, operationCount - shownRows)));

  useInput((input, key) => {
    if (input === "q") {
      exit();
    } else if (key.escape || input === "j") {
      onClose();
    } else if (key.leftArrow) {
      show(shownIndex - 1);
    } else if (key.rightArrow) {
      show(shownIndex + 1);
    } else if (key.upArrow) {
      scrollBy(-1);
    } else if (key.downArrow) {
      scrollBy(1);
    } else if (key.pageUp) {
      scrollBy(-shownRows);
    } else if (key.pageDown) {
      scrollBy(shownRows);
    } else if (input === "o" && shownFile !== undefined) {
      openInVsCode(shownFile, setNote);
    }
  });

  const message =
    journalFiles === undefined || (shownFile !== undefined && journal === undefined)
      ? "reading…"
      : shownFile === undefined
        ? "no Apply run has a journal yet; run a proof"
        : undefined;
  const title = () =>
    h(
      Text,
      { key: "file", wrap: "truncate-middle" },
      h(Text, { bold: true }, `Journal ${shownIndex + 1} of ${journalFiles.length}`),
      `  ${path.basename(shownFile)}`,
    );
  const body =
    message !== undefined
      ? [h(Text, { key: "message", dimColor: true }, message)]
      : journal.error !== undefined
        ? [title(), h(Text, { key: "error", color: "red" }, journal.error)]
        : [
            title(),
            h(
              Text,
              { key: "run", wrap: "truncate-end" },
              `run ${journal.runId}, ${operationCount} operations, `,
              h(Text, { color: OUTCOME_COLOR[journal.outcome] }, journal.outcome),
            ),
            ...journal.operations
              .slice(firstRow, firstRow + shownRows)
              .map(({ index, kind, destination, state, notes }) =>
                h(
                  Text,
                  { key: index, wrap: "truncate-end" },
                  `${String(index).padStart(3)}  ${kind.padEnd(7)} `,
                  h(
                    Text,
                    { color: STEP_COLOR[state], dimColor: state === "not run" },
                    state.padEnd(8),
                  ),
                  ` ${destination}`,
                  notes.length > 0 ? h(Text, { dimColor: true }, `  (${notes.join("; ")})`) : null,
                ),
              ),
            h(
              Text,
              { key: "range", dimColor: true },
              `operations ${Math.min(firstRow + 1, operationCount)} to ${Math.min(firstRow + shownRows, operationCount)} of ${operationCount}`,
            ),
          ];
  return h(
    Box,
    { flexDirection: "column" },
    h(Box, { flexDirection: "column", borderStyle: "round", paddingX: 1 }, ...body),
    h(
      Box,
      { paddingX: 1 },
      h(
        Text,
        { wrap: "truncate-end" },
        h(
          Text,
          { dimColor: true },
          "←/→ journal   ↑/↓ scroll   o open in VS Code   Esc back   q quit",
        ),
        note === "" ? null : h(Text, { color: "cyan" }, `   ${note}`),
      ),
    ),
  );
}

function Header({ status }) {
  const vortex =
    status === undefined
      ? h(Text, { dimColor: true }, "checking…")
      : status.vortexAnswers
        ? h(Text, { color: "green" }, `running on port ${status.port}`)
        : h(Text, { color: "yellow" }, `not running (port ${status.port})`);
  const setup =
    status === undefined
      ? h(Text, { dimColor: true }, "checking…")
      : status.isSetUp
        ? h(Text, null, status.root)
        : h(Text, { color: "yellow" }, `none yet (${status.root})`);
  return h(
    Box,
    { flexDirection: "column", paddingX: 1 },
    h(Text, { bold: true }, "Fake Skyrim SE"),
    h(Text, null, "Vortex: ", vortex),
    h(Text, { wrap: "truncate-middle" }, "Setup:  ", setup),
  );
}

function Actions({ isBusy, canReadKeys, journalCount }) {
  return h(
    Box,
    { flexDirection: "column", borderStyle: "round", paddingX: 1, width: 42, flexShrink: 0 },
    h(Text, { bold: true }, "Actions"),
    ...ACTIONS.map(({ key, label }) =>
      h(
        Text,
        { key, dimColor: isBusy || !canReadKeys },
        h(Text, { color: "cyan" }, key),
        `  ${label}`,
      ),
    ),
    h(
      Text,
      { dimColor: !canReadKeys || journalCount === 0 },
      h(Text, { color: "cyan" }, "j"),
      `  view the Apply journals (${journalCount})`,
    ),
    h(Text, { dimColor: !canReadKeys }, h(Text, { color: "cyan" }, "q"), "  quit"),
  );
}

/** The lines a check takes: itself, the problems shown and a count of the rest. */
const rowsOfCheck = ({ problems }) =>
  1 + Math.min(problems.length, PROBLEMS_SHOWN) + (problems.length > PROBLEMS_SHOWN ? 1 : 0);

function Check({ check }) {
  const { name, state, problems } = check;
  return h(
    Box,
    { flexDirection: "column" },
    h(Text, { color: RUN_COLOR[state], wrap: "truncate-end" }, `${CHECK_MARK[state]} ${name}`),
    ...problems
      .slice(0, PROBLEMS_SHOWN)
      .map((problem, index) =>
        h(Text, { key: index, dimColor: true, wrap: "truncate-end" }, `    ${problem}`),
      ),
    problems.length > PROBLEMS_SHOWN
      ? h(
          Text,
          { dimColor: true },
          `    and ${problems.length - PROBLEMS_SHOWN} more, in the output`,
        )
      : null,
  );
}

function LastRun({ run, checks, now }) {
  const body =
    run === undefined
      ? [h(Text, { key: "none", dimColor: true }, "nothing run yet")]
      : [
          h(Text, { key: "what" }, run.action.label),
          h(
            Text,
            { key: "state", color: RUN_COLOR[run.state] },
            run.state === RunState.Failed ? `failed (exit code ${run.exitCode})` : run.state,
            // the clock's last tick can be from before the run started
            `, ${secondsBetween(run.startedAt, run.endedAt ?? Math.max(now, run.startedAt))} s`,
          ),
          ...checks.map((check) => h(Check, { key: check.name, check })),
        ];
  return h(
    Box,
    { flexDirection: "column", borderStyle: "round", paddingX: 1, flexGrow: 1 },
    h(Text, { bold: true }, "Last run"),
    ...body,
  );
}

function Log({ lines, rows }) {
  const shown = lines.slice(-Math.max(rows, 3));
  return h(
    Box,
    { flexDirection: "column", borderStyle: "round", paddingX: 1 },
    h(Text, { bold: true }, "Output"),
    ...(shown.length === 0
      ? [h(Text, { key: "none", dimColor: true }, "a command's output shows here")]
      : shown.map((line, index) =>
          h(Text, { key: index, wrap: "truncate-end" }, line === "" ? " " : line),
        )),
  );
}

function Screen() {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();
  const status = useStatus();
  const { run, lines, checks, start } = useCommand();
  const isBusy = run?.state === RunState.Running;
  const now = useClock(isBusy);
  const [isShowingJournals, setShowingJournals] = useState(false);
  const terminalRows = stdout.rows ?? 30;
  // the header, the taller of the two boxes, and the output box's border and title
  const rowsAroundLog =
    HEADER_ROWS +
    Math.max(ACTIONS.length + 5, 5 + checks.reduce((rows, check) => rows + rowsOfCheck(check), 0)) +
    4;

  // with no keys to read there is nothing to wait for
  useEffect(() => {
    if (!isRawModeSupported && status !== undefined) {
      exit();
    }
  }, [isRawModeSupported, status, exit]);

  if (isShowingJournals) {
    return h(
      Box,
      { flexDirection: "column" },
      h(Header, { status }),
      // the header, the journal's border, its two title lines, its range line and the key hints
      h(Journals, {
        rows: terminalRows - HEADER_ROWS - 7,
        onClose: () => setShowingJournals(false),
      }),
    );
  }

  return h(
    Box,
    { flexDirection: "column" },
    h(Header, { status }),
    h(
      Box,
      null,
      h(Actions, {
        isBusy,
        canReadKeys: isRawModeSupported,
        journalCount: status?.journalCount ?? 0,
      }),
      h(LastRun, { run, checks, now }),
    ),
    h(Log, { lines, rows: terminalRows - rowsAroundLog }),
    isRawModeSupported
      ? h(Keys, { isBusy, onAction: start, onJournals: () => setShowingJournals(true) })
      : h(
          Box,
          { paddingX: 1 },
          h(
            Text,
            { color: "yellow" },
            "This terminal can't read single keys; run the commands of fake-skyrimse.mjs directly.",
          ),
        ),
  );
}

render(h(Screen));
