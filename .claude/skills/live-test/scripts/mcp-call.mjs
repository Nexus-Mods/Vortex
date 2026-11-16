// Drives the running Vortex through the chrome-devtools MCP server from a shell, for sessions where
// the server's tools aren't connected (it only connects when the session starts, and only if Vortex
// was already listening on 127.0.0.1:9222). Starts the server exactly as .mcp.json configures it.
//
// Usage: node mcp-call.mjs [--config <.mcp.json>] [--wait-for-app] <step>...
//
//   --wait-for-app        keep looking for the Vortex main window for up to 5 minutes instead of
//                         failing at once (right after starting the app)
//
//   steps:<file>          the steps in the file, one per line (blank lines and lines starting with
//                         "#" are skipped). Nothing in a file needs shell quoting, so use one for
//                         steps with quotes or apostrophes in them, and for a take you film twice
//   eval:<file.js>        evaluate_script with the file's content (an arrow function)
//   js:<function>         evaluate_script with an inline function, e.g. "js:() => document.title"
//   snapshot              take_snapshot (the accessibility tree, with element uids)
//   click:<name>          click the element whose snapshot line contains "<name>" in quotes,
//                         e.g. click:Continue, or narrow it: 'click:button "Install Now"'.
//                         Waits up to 5 seconds for it to show. Refuses when several elements of
//                         the same kind match (the same button on every row): anchor it instead
//   click:<name>@@<after> the same, but only within the row or card that holds the line containing
//                         "<after>", e.g. "click:Add game@@Untitled Goose Game" for that game's tile.
//                         Never reaches into the next row, and refuses when that row has several
//   hover:<name>          hover instead of click; takes the same forms
//   fill:<name>=<text>    type into the text field whose snapshot line contains "<name>"; takes
//                         the same forms, and the text is everything after the first "="
//   key:<key>             press a key, e.g. key:Enter
//   screenshot:<file>     take_screenshot into the file (or screenshot:<file>@@<name> for an element)
//   record:<file.mp4>     screencast_start into the file; the steps up to `stop` are filmed
//   stop                  screencast_stop
//   wait:<ms>             pause
//   until:<function>      poll the function every second until it returns something truthy (up to
//                         10 minutes), e.g. "until:() => document.body.innerText.includes('complete')".
//                         A call that throws counts as "not yet" (the page may be reloading).
//                         Prints a line every 30 seconds while it waits.
//                         Takes a file too: "until:<attach.js>" attaches as soon as the app is up
//   ?<step>               any step, optional: a failure is reported and the run goes on
//                         (for a dialog that only sometimes shows)
//   tool:<name>           print the tool's input schema (for tools without a step of their own)
//   @<calls.json>         raw calls: [{ "name": "<tool>", "arguments": { ... } }]; pageId is added
//
// All steps of one invocation share one server session, which a screencast needs
// (screencast_start ... screencast_stop) and element uids too: a uid only lives as long as the
// session that took the snapshot.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
let configPath;
if (argv[0] === "--config") {
  configPath = argv[1];
  argv.splice(0, 2);
} else {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    if (existsSync(path.join(dir, ".mcp.json"))) {
      configPath = path.join(dir, ".mcp.json");
      break;
    }
    if (dir === path.dirname(dir)) break;
  }
}
const waitForApp = argv[0] === "--wait-for-app";
if (waitForApp) argv.shift();
// "steps:<file>" stands for the steps listed in the file
const steps = argv.flatMap((arg) =>
  arg.startsWith("steps:")
    ? readFileSync(arg.slice("steps:".length), "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#"))
    : [arg],
);
if (configPath === undefined || steps.length === 0) {
  console.error(
    "usage: node mcp-call.mjs [--config <.mcp.json>] [--wait-for-app] <step>... (see the file header)",
  );
  process.exit(2);
}

const server = JSON.parse(readFileSync(configPath, "utf8")).mcpServers["chrome-devtools"];
const child = spawn([server.command, ...server.args].join(" "), {
  stdio: ["pipe", "pipe", "pipe"],
  shell: true,
  // its own process group, so stopServer can end the whole tree (Windows uses taskkill instead)
  detached: process.platform !== "win32",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopServer();
    process.exit(130);
  });
}
let stderr = "";
child.stderr.on("data", (chunk) => (stderr += chunk));

const pending = new Map();
const failPending = (why) => {
  const err = new Error(`chrome-devtools server ${why}\n${stderr.slice(-2000)}`);
  for (const [, entry] of pending) entry.reject(err);
  pending.clear();
};
child.on("error", (err) => failPending(`failed to start: ${err.message}`));
child.on("exit", (code, signal) =>
  failPending(`exited (${code !== null ? `code ${code}` : `signal ${signal}`})`),
);

let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  for (let nl = buffer.indexOf("\n"); nl >= 0; nl = buffer.indexOf("\n")) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (line === "") continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }
    if (message.method === "roots/list") {
      // The server only writes screenshots and recordings inside the roots its client declares.
      const roots = [...new Set([path.dirname(configPath), process.cwd(), tmpdir()])].map(
        (dir) => ({
          uri: pathToFileURL(dir).href,
          name: path.basename(dir),
        }),
      );
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { roots } })}\n`,
      );
      continue;
    }
    pending.get(message.id)?.resolve(message);
    pending.delete(message.id);
  }
});

let nextId = 1;
function request(method, params, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      reject(
        new Error(`chrome-devtools server exited (code ${child.exitCode})\n${stderr.slice(-2000)}`),
      );
      return;
    }
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out\n${stderr.slice(-2000)}`));
    }, timeoutMs);
    pending.set(id, {
      resolve(message) {
        clearTimeout(timer);
        resolve(message);
      },
      reject(err) {
        clearTimeout(timer);
        reject(err);
      },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

async function call(name, args) {
  const response = await request("tools/call", { name, arguments: args });
  if (response.error) throw new Error(`${name}: ${JSON.stringify(response.error)}`);
  const text = (response.result?.content ?? []).map((c) => c.text ?? `[${c.type}]`).join("\n");
  if (response.result?.isError) throw new Error(`${name}: ${text}`);
  return text;
}

let exitCode = 0;
let pageId;
let recording = false;
try {
  const init = await request(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: { roots: {} },
      clientInfo: { name: "vortex-live-test", version: "1.0.0" },
    },
    180000,
  );
  if (init.error) throw new Error(`initialize: ${JSON.stringify(init.error)}`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  // The main window is the page that loaded index.html; the splash screen and devtools extensions
  // are pages too.
  const appDeadline = Date.now() + (waitForApp ? 300000 : 0);
  for (;;) {
    let pages;
    try {
      pages = await call("list_pages", {});
    } catch (err) {
      pages = err.message; // nothing is listening yet
    }
    const main = /^(\d+): .*index\.html/m.exec(pages);
    if (main !== null) {
      pageId = Number(main[1]);
      break;
    }
    if (Date.now() > appDeadline) {
      throw new Error(`no Vortex main window among the pages:\n${pages}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  for (const rawStep of steps) {
    // "?step" may fail (a dialog that only sometimes shows) without ending the run
    const optional = rawStep.startsWith("?");
    try {
      await runStep(optional ? rawStep.slice(1) : rawStep);
    } catch (err) {
      if (!optional) throw err;
      console.log(`skipped: ${err.message}`);
    }
  }
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  exitCode = 1;
} finally {
  // a recording is only written out when it is stopped
  if (recording) await call("screencast_stop", { pageId }).catch(() => undefined);
  stopServer();
  setTimeout(() => process.exit(exitCode), 300);
}

// Ends the server and everything it started. The server runs under a shell (and under pnpm), so
// killing the child alone leaves the server itself running.
function stopServer() {
  child.stdin.end();
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill();
    }
  }
}

/**
 * Picks the element a step names out of snapshot lines. `spec` is `<name>` or `<name>@@<after>`.
 * Returns `{ line, uid }`, `{ missing }` when nothing matches (yet), or throws when the name fits
 * several elements of the same kind, anchored or not: clicking the first of those is how a test
 * acts on the wrong row.
 */
function pickElement(lines, spec, roles) {
  const quoted = (text) => (text.includes('"') ? text : `"${text}"`);
  const role = (l) => /uid=\S+\s+(\S+)/.exec(l)?.[1];
  const indent = (l) => /^\s*/.exec(l)[0].length;
  const [name, after] = spec.split("@@");
  const needle = quoted(name);
  const isMatch = (l) =>
    l.includes(needle) && /uid=\S+/.test(l) && (roles === undefined || roles.test(l));
  let matches;
  if (after === undefined) {
    matches = lines.filter(isMatch);
  } else {
    // The snapshot is a tree drawn with indentation: a line's parent is the nearest shallower
    // line above it, and its subtree is every deeper line below it.
    const parentOf = (i) => {
      for (let j = i - 1; j >= 0; j--) if (indent(lines[j]) < indent(lines[i])) return j;
      return -1;
    };
    const subtreeEnd = (i) => {
      let j = i + 1;
      while (j < lines.length && indent(lines[j]) > indent(lines[i])) j++;
      return j;
    };
    // The matches in the anchor's own row or card. Starts with what is below the anchor inside
    // its parent and widens one ancestor at a time. A node that has a sibling of its own kind is
    // one of a list's repeated items (the row, or the anchor itself in a flat list): the search
    // ends at the next such sibling and never widens past that node, so it can't reach into the
    // row after it.
    const near = (anchor) => {
      for (let node = anchor; node >= 0; node = parentOf(node)) {
        const parent = parentOf(node);
        const end = parent >= 0 ? subtreeEnd(parent) : lines.length;
        const nodeRole = role(lines[node]);
        const nodeIndent = indent(lines[node]);
        let stop = end;
        let repeated = false;
        for (let i = parent + 1; i < end; i++) {
          if (i === node || nodeRole === undefined) continue;
          if (indent(lines[i]) !== nodeIndent || role(lines[i]) !== nodeRole) continue;
          repeated = true;
          if (i > node && stop === end) stop = i;
        }
        const found = lines.slice(node + 1, stop).filter(isMatch);
        if (found.length > 0 || repeated) return found;
      }
      return [];
    };
    // The anchor text may be on several lines (a tile's image and its title, or the same name
    // elsewhere on the page): look near each, and let the tie check below catch a real ambiguity.
    const anchors = lines.flatMap((l, i) => (l.includes(quoted(after)) ? [i] : []));
    if (anchors.length === 0) return { missing: quoted(after) };
    matches = [...new Set(anchors.flatMap(near))];
    if (matches.length === 0)
      return { missing: `${needle} in the row or card of ${quoted(after)}` };
  }
  if (matches.length === 0) return { missing: needle };
  // A control and the text inside it share a name; only the same kind of element twice is a tie.
  const ties = matches.filter((l) => role(l) === role(matches[0]));
  if (ties.length > 1) {
    const hint =
      after === undefined
        ? `anchor it to its row or card (${name}@@<text in that row>)`
        : `narrow the name or the anchor (a role helps: 'button "${name}"@@image "${after}"')`;
    throw new Error(
      `${ties.length} elements match ${needle}; ${hint}:\n${ties
        .slice(0, 6)
        .map((l) => `  ${l.trim()}`)
        .join("\n")}`,
    );
  }
  return { line: matches[0].trim(), uid: /uid=(\S+)/.exec(matches[0])[1] };
}

// Waits a few seconds for the element to show, so a step can follow a click that changes the page.
async function findElement(spec, roles) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const snapshot = await call("take_snapshot", { pageId });
    if (!snapshot.includes("uid=")) {
      throw new Error(
        `the snapshot has no element uids: the chrome-devtools server's output changed?\n${snapshot.slice(0, 500)}`,
      );
    }
    const found = pickElement(snapshot.split("\n"), spec, roles);
    if (found.uid !== undefined) return found;
    if (Date.now() > deadline) throw new Error(`nothing in the snapshot matches ${found.missing}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function runStep(step) {
  {
    const [kind, rest] = step.startsWith("@")
      ? ["@", step.slice(1)]
      : step.includes(":")
        ? [step.slice(0, step.indexOf(":")), step.slice(step.indexOf(":") + 1)]
        : [step, ""];
    console.log(`\n### ${step.length > 100 ? `${step.slice(0, 100)}...` : step}`);
    if (kind === "eval" || kind === "js") {
      const fn = kind === "eval" ? readFileSync(rest, "utf8") : rest;
      console.log(await call("evaluate_script", { pageId, function: fn }));
    } else if (kind === "snapshot") {
      console.log(await call("take_snapshot", { pageId }));
    } else if (kind === "click" || kind === "hover") {
      const { line, uid } = await findElement(rest);
      console.log(`${line}\n${await call(kind, { pageId, uid })}`);
    } else if (kind === "screenshot") {
      const sep = rest.indexOf("@@");
      if (sep < 0) {
        console.log(await call("take_screenshot", { pageId, filePath: path.resolve(rest) }));
      } else {
        const { line, uid } = await findElement(rest.slice(sep + 2));
        const filePath = path.resolve(rest.slice(0, sep));
        console.log(`${line}\n${await call("take_screenshot", { pageId, uid, filePath })}`);
      }
    } else if (kind === "fill") {
      // The text starts after the first "=", so it may contain "=" itself (a URL with a query).
      const eq = rest.indexOf("=");
      if (eq < 0) throw new Error(`fill needs <name>=<text>, got "${rest}"`);
      const { line, uid } = await findElement(rest.slice(0, eq), /textbox|searchbox|combobox/);
      console.log(`${line}\n${await call("fill", { pageId, uid, value: rest.slice(eq + 1) })}`);
    } else if (kind === "key") {
      console.log(await call("press_key", { pageId, key: rest }));
    } else if (kind === "record") {
      console.log(await call("screencast_start", { pageId, filePath: path.resolve(rest) }));
      recording = true;
    } else if (kind === "stop") {
      console.log(await call("screencast_stop", { pageId }));
      recording = false;
    } else if (kind === "until") {
      // Polls instead of one long evaluate_script: a single call is cut off by the protocol
      // timeout long before a collection install finishes.
      // A call that throws counts as "not yet": the page may be reloading, or the handle the
      // function uses may not be attached again.
      const fn = /\.js$/.test(rest) && existsSync(rest) ? readFileSync(rest, "utf8") : rest;
      const started = Date.now();
      const deadline = started + 600000;
      let lastError;
      let polls = 0;
      for (;;) {
        let result = "";
        try {
          result = await call("evaluate_script", { pageId, function: fn });
          lastError = undefined;
        } catch (err) {
          lastError = err.message;
        }
        if (
          !/```json\s*(false|null|undefined|0|"")\s*```/.test(result) &&
          result.includes("```json")
        ) {
          console.log(result);
          break;
        }
        if (Date.now() > deadline) {
          throw new Error(
            `until: not true after 10 minutes${lastError ? ` (last error: ${lastError})` : ""}`,
          );
        }
        // a sign of life, so a long wait isn't taken for a hang
        if (++polls % 30 === 0) {
          console.log(`... still waiting (${Math.round((Date.now() - started) / 1000)} s)`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } else if (kind === "wait") {
      await new Promise((resolve) => setTimeout(resolve, Number(rest)));
    } else if (kind === "tool") {
      const tools = await request("tools/list", {});
      const tool = tools.result.tools.find((t) => t.name === rest);
      console.log(tool ? JSON.stringify(tool, null, 2) : `no tool named ${rest}`);
    } else if (kind === "@") {
      for (const raw of JSON.parse(readFileSync(rest, "utf8"))) {
        console.log(`# ${raw.name}`);
        console.log(await call(raw.name, { pageId, ...raw.arguments }));
      }
    } else {
      throw new Error(`unknown step "${step}"`);
    }
  }
}
