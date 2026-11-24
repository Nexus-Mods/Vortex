import type { record as rrwebRecord } from "@mixpanel/rrweb";
import { REPLAY_CHECKOUT_MS, redactSensitiveText } from "@vortex/shared";
import type { IFeedbackReplayEvent } from "@vortex/shared/ipc";

import { log } from "@/util/log";

/**
 * A recording of the window for the last few minutes, so a feedback can show what happened on
 * screen before it was sent. Every piece of text is replaced by asterisks before it leaves the
 * renderer: the page's text by the recorder, the text in attributes (tooltips, labels,
 * placeholders) here. Pictures are left out, and what the user types is masked too. Main keeps
 * the recording (`src/main/src/feedback/replay.ts`). It goes there a few seconds at a time, as
 * redacted text, which crosses for little more than the cost of copying it; main compresses it on
 * zlib's own threads, so this window doesn't do that work.
 */

/**
 * How often the events recorded since the last batch go to main. A crash of the window loses at
 * most this much; the feedback dialog hands over the rest before it puts the recording aside.
 */
const BATCH_MS = 5_000;

// the recorder's event types this file reads
const EVENT_META = 4;
const EVENT_FULL_SNAPSHOT = 2;
const EVENT_INCREMENTAL = 3;
const SOURCE_MUTATION = 0;

/**
 * Attributes kept as they are, because they shape the page and say nothing about the user. Every
 * other attribute's value is masked, as page text is. `id` is kept only when it looks like a plain
 * name (see `isPlainId`).
 */
const KEPT_ATTRIBUTES = new Set([
  "class",
  "style",
  "role",
  "type",
  "rel",
  "dir",
  "hidden",
  "disabled",
  "checked",
  "selected",
  "open",
  "tabindex",
  "draggable",
  "width",
  "height",
  "colspan",
  "rowspan",
  "aria-hidden",
  "aria-expanded",
  "aria-selected",
  "aria-checked",
  "aria-disabled",
  "aria-pressed",
  "aria-current",
  // the name of an icon drawn from the icon font, such as "home"
  "data-symbol",
  // the state of a control, which the stylesheets read; never a name
  "data-headlessui-state",
  "data-anchor",
  "data-sticky",
  "data-reduce-motion",
  "data-theme",
  "data-align",
  "data-toolbar-control",
  "data-cap",
  "data-stroke",
  // SVG icons
  "xmlns",
  "viewbox",
  "d",
  "fill",
  "fill-rule",
  "clip-rule",
  "clip-path",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "points",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "transform",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "vector-effect",
  "gradientunits",
  "gradienttransform",
  "offset",
  "stop-color",
  "preserveaspectratio",
  // the recorder's own: an inlined stylesheet, the size of a left-out element
  "_csstext",
  "rr_width",
  "rr_height",
]);

const maskText = (value: string): string => value.replace(/\S/g, "*");

/**
 * An id the page's stylesheets and icon sprites refer to, such as `content` or `icon-download`.
 * Vortex builds some ids from a mod's name and id (`mods--<name>--<id>`), and libraries number
 * theirs; those, and anything with a space or a long number in it, are masked.
 */
const isPlainId = (value: string): boolean =>
  /^[A-Za-z][A-Za-z0-9_-]*$/.test(value) && !value.includes("--") && !/\d{3,}/.test(value);

function maskAttribute(name: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  const lower = name.toLowerCase();
  if (KEPT_ATTRIBUTES.has(lower) || lower.startsWith("rr_")) return value;
  if (lower === "id" && isPlainId(value)) return value;
  // a link to an icon in the page's own sprite
  if ((lower === "href" || lower === "xlink:href") && value.startsWith("#")) return value;
  return maskText(value);
}

interface ISerializedNode {
  attributes?: Record<string, unknown>;
  childNodes?: ISerializedNode[];
}

function maskNode(node: ISerializedNode | undefined): void {
  if (node === undefined || node === null) return;
  if (node.attributes !== undefined) {
    for (const [name, value] of Object.entries(node.attributes)) {
      node.attributes[name] = maskAttribute(name, value);
    }
  }
  node.childNodes?.forEach(maskNode);
}

/** Masks the attribute values an event carries. Changes the event in place and returns it. */
export function maskReplayEvent(event: IFeedbackReplayEvent): IFeedbackReplayEvent {
  const data = event.data as Record<string, unknown> | undefined;
  if (data === undefined) return event;

  if (event.type === EVENT_META) {
    // the page's address holds the install folder, which can hold the user's name
    data.href = "vortex://app";
  } else if (event.type === EVENT_FULL_SNAPSHOT) {
    maskNode(data.node as ISerializedNode);
  } else if (event.type === EVENT_INCREMENTAL && data.source === SOURCE_MUTATION) {
    for (const added of (data.adds as { node: ISerializedNode }[] | undefined) ?? []) {
      maskNode(added.node);
    }
    for (const changed of (data.attributes as
      | { attributes: Record<string, unknown> }[]
      | undefined) ?? []) {
      for (const [name, value] of Object.entries(changed.attributes)) {
        changed.attributes[name] = maskAttribute(name, value);
      }
    }
  }
  return event;
}

/** The events recorded since the last batch was handed over, each as redacted JSON text. */
interface IBatch {
  texts: string[];
  startsSegment: boolean;
  startsAt: number;
  endsAt: number;
}

let batch: IBatch | undefined;
let batchTimer: ReturnType<typeof setInterval> | undefined;
/** Whether recording is on: set from the start, before the recorder has loaded. */
let recording = false;
/** Stops the recorder; undefined until the recorder has started. */
let stopRecorder: (() => void) | undefined;

/**
 * Hands main the events recorded since the last batch, as one text, which main compresses on its
 * own threads. A batch that continues a segment starts with a comma, so a segment's batches one
 * after another give its events as one comma-separated text.
 */
function handOver(): void {
  const done = batch;
  batch = undefined;
  if (done === undefined) return;
  window.api.feedback.replayBatch({
    text: (done.startsSegment ? "" : ",") + done.texts.join(","),
    startsSegment: done.startsSegment,
    startsAt: done.startsAt,
    endsAt: done.endsAt,
    eventCount: done.texts.length,
  });
}

/**
 * Takes one event from the recorder: masks it, writes it out as JSON with the user's name taken
 * out of the paths it holds (the install folder in its stylesheets) and any signed link, as logs
 * are, and adds it to the batch. The meta event, which comes before every full picture of the
 * page, starts a segment, and so a batch of its own.
 */
function takeEvent(event: IFeedbackReplayEvent): void {
  const masked = maskReplayEvent(event);
  const startsSegment = masked.type === EVENT_META;
  if (startsSegment) handOver();
  const text = redactSensitiveText(JSON.stringify(masked));
  if (batch === undefined) {
    batch = { texts: [], startsSegment, startsAt: masked.timestamp, endsAt: masked.timestamp };
  }
  batch.texts.push(text);
  batch.endsAt = masked.timestamp;
}

/**
 * Hands main the events recorded since the last batch. Main takes a window's messages in the order
 * they were sent, so a request sent after this finds them there.
 */
export function flushFeedbackReplay(): void {
  handOver();
}

/**
 * Starts recording. The recorder is loaded only now, off the start-up path. Recording is best
 * effort: it never stops the app.
 */
export async function startFeedbackReplay(): Promise<void> {
  if (recording) return;
  recording = true;
  try {
    // its types are read through a type import, which the dynamic import does not carry
    const { record } = (await import("@mixpanel/rrweb")) as unknown as {
      record: typeof rrwebRecord;
    };
    // stopped while the recorder was loading
    if (!recording || stopRecorder !== undefined) return;
    batchTimer = setInterval(handOver, BATCH_MS);
    stopRecorder = record<IFeedbackReplayEvent>({
      emit: takeEvent,
      checkoutEveryNms: REPLAY_CHECKOUT_MS,
      maskAllInputs: true,
      maskTextSelector: "*",
      blockSelector: "img, video, canvas, iframe, webview, picture",
      inlineImages: false,
      recordCanvas: false,
      collectFonts: false,
      slimDOMOptions: "all",
      sampling: { mousemove: 50, scroll: 150, input: "last" },
      errorHandler: () => true,
    });
  } catch (err) {
    log("warn", "failed to start recording the window for feedback", { error: err });
  }
}

/** Stops recording, and has main forget what was recorded. */
export function stopFeedbackReplay(): void {
  if (!recording) return;
  recording = false;
  stopRecorder?.();
  stopRecorder = undefined;
  if (batchTimer !== undefined) clearInterval(batchTimer);
  batchTimer = undefined;
  batch = undefined;
  window.api.feedback.replayReset();
}
