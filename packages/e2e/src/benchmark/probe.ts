/**
 * The in-page performance probe the collection benchmark installs in the Vortex renderer.
 *
 * It is plain JavaScript, not TypeScript: it runs in the page through page.evaluate, and the e2e
 * package compiles without the DOM library. It records, while a measurement is running:
 *
 * - frames: the gap between consecutive requestAnimationFrame callbacks. 16.7 ms is a smooth
 *   60 Hz frame; a long gap is a frame the user saw stall.
 * - long tasks: main-thread tasks over 50 ms (the Long Tasks API)
 * - long animation frames: frames over 50 ms with their blocking time (the Long Animation Frames
 *   API), which also catches rendering and layout work a long task misses
 * - events: input events whose time from input to the next paint was 16 ms or more (the Event
 *   Timing API; the same measurement Interaction to Next Paint is built on)
 * - DOM mutations, so a measurement can wait for the page to settle after an action
 *
 * Everything uses performance.now() in the page, so round trips to Playwright do not distort it.
 */
import type { Page } from "@playwright/test";

const PROBE_SOURCE = `(() => {
  if (window.__vbench !== undefined) {
    return;
  }
  const b = {
    recording: false,
    startedAt: 0,
    frames: [],
    longTasks: [],
    loafs: [],
    events: [],
    mutations: 0,
    lastMutation: 0,
    lastFrame: 0,
  };
  const tick = (now) => {
    if (b.recording && b.lastFrame !== 0) {
      b.frames.push(now - b.lastFrame);
    }
    b.lastFrame = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const observe = (type, onEntry, extra) => {
    try {
      new PerformanceObserver((list) => {
        if (b.recording) {
          for (const entry of list.getEntries()) {
            onEntry(entry);
          }
        }
      }).observe({ type, ...extra });
    } catch (err) {
      // an entry type this Chromium lacks; its metric stays empty
    }
  };
  observe("longtask", (e) => b.longTasks.push(e.duration));
  observe("long-animation-frame", (e) =>
    b.loafs.push({ duration: e.duration, blocking: e.blockingDuration ?? 0 }),
  );
  observe("event", (e) => b.events.push({ name: e.name, duration: e.duration }), {
    durationThreshold: 16,
  });
  const describe = (node) => {
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (el === null) {
      return "?";
    }
    const cls = [...el.classList].slice(0, 3).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  new MutationObserver((list) => {
    b.mutations += list.length;
    b.lastMutation = performance.now();
    if (b.recording) {
      for (const m of list) {
        const key = m.type + (m.attributeName ? ":" + m.attributeName : "") + " " + describe(m.target);
        b.targets[key] = (b.targets[key] ?? 0) + 1;
      }
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });

  b.start = () => {
    b.frames = [];
    b.longTasks = [];
    b.loafs = [];
    b.events = [];
    b.mutations = 0;
    b.targets = {};
    b.lastMutation = 0;
    b.startedAt = performance.now();
    b.recording = true;
  };
  b.quietFor = () => performance.now() - Math.max(b.lastMutation, b.startedAt);
  b.stop = () => {
    b.recording = false;
    const now = performance.now();
    return {
      elapsedMs: now - b.startedAt,
      settledMs: b.lastMutation === 0 ? 0 : b.lastMutation - b.startedAt,
      mutations: b.mutations,
      // what changed most, for telling why an action never settled
      busiest: Object.entries(b.targets ?? {})
        .sort((x, y) => y[1] - x[1])
        .slice(0, 5)
        .map(([target, count]) => ({ target, count })),
      frames: b.frames,
      longTasks: b.longTasks,
      loafs: b.loafs,
      events: b.events,
    };
  };
  window.__vbench = b;
})()`;

export interface IProbeSample {
  elapsedMs: number;
  /** time from the start of the measurement to the last DOM change it saw */
  settledMs: number;
  mutations: number;
  busiest: Array<{ target: string; count: number }>;
  frames: number[];
  longTasks: number[];
  loafs: Array<{ duration: number; blocking: number }>;
  events: Array<{ name: string; duration: number }>;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

function isSample(value: unknown): value is IProbeSample {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, "elapsedMs") === "number" &&
    typeof Reflect.get(value, "settledMs") === "number" &&
    isNumberArray(Reflect.get(value, "frames")) &&
    isNumberArray(Reflect.get(value, "longTasks")) &&
    Array.isArray(Reflect.get(value, "loafs")) &&
    Array.isArray(Reflect.get(value, "events"))
  );
}

export async function installProbe(page: Page): Promise<void> {
  await page.evaluate(PROBE_SOURCE);
}

export async function startRecording(page: Page): Promise<void> {
  await page.evaluate("window.__vbench.start()");
}

export async function stopRecording(page: Page): Promise<IProbeSample> {
  const sample: unknown = await page.evaluate("window.__vbench.stop()");
  if (!isSample(sample)) {
    throw new Error("the performance probe returned an unexpected result");
  }
  return sample;
}

/**
 * Wait until the page has made no DOM change for `quietMs`, or give up after `timeoutMs`.
 * Returns false on timeout: some views animate or tick constantly, and a measurement over one of
 * them reports its elapsed time instead of a settle time.
 */
export async function waitForQuiet(
  page: Page,
  quietMs: number,
  timeoutMs: number,
): Promise<boolean> {
  try {
    // a function, not a string: Vortex's content security policy forbids evaluating strings, and
    // Playwright evaluates a string predicate that way
    await page.waitForFunction(
      (quiet) => {
        const probe = (globalThis as { __vbench?: { quietFor: () => number } }).__vbench;
        return probe !== undefined && probe.quietFor() >= quiet;
      },
      quietMs,
      { timeout: timeoutMs, polling: 50 },
    );
    return true;
  } catch (err) {
    if (process.env.VORTEX_BENCH_DEBUG === "1") {
      process.stderr.write(`waitForQuiet: ${err instanceof Error ? err.message : String(err)}\n`);
    }
    return false;
  }
}
