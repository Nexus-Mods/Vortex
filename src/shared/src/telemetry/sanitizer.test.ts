import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { describe, expect, it, vi } from "vitest";

import {
  bucketCount,
  sanitizeResourceAttributes,
  sanitizeSpan,
  sanitizeSpanAttributes,
  SanitizingSpanExporter,
} from "./sanitizer";

describe("bucketCount", () => {
  it("matches the ranges", () => {
    expect(bucketCount(0)).toBe("0-50");
    expect(bucketCount(50)).toBe("0-50");
    expect(bucketCount(51)).toBe("51-100");
    expect(bucketCount(100)).toBe("51-100");
    expect(bucketCount(101)).toBe("101-150");
    expect(bucketCount(73)).toBe("51-100");
  });

  it("accepts numeric strings (setErrorContext stores counts as strings)", () => {
    expect(bucketCount("73")).toBe("51-100");
  });

  it("returns 'unknown' for non-numeric or negative input", () => {
    expect(bucketCount("nope")).toBe("unknown");
    expect(bucketCount(-1)).toBe("unknown");
  });
});

describe("sanitizeSpanAttributes (baseline / consent given)", () => {
  it("keeps non-allow-listed keys but still redacts string values", () => {
    const result = sanitizeSpanAttributes(
      {
        "context.value": "ENOENT 'C:\\Users\\bob\\mod.pak'",
        "mod.baseName": "Animate Dead++.pak",
        "deployment.method": "hardlink",
      },
      false,
    );
    expect(result).toEqual({
      "context.value": "ENOENT 'C:/Users/<USER>/mod.pak'",
      "mod.baseName": "Animate Dead++.pak",
      "deployment.method": "hardlink",
    });
  });

  it("keeps exact counts (no bucketing) when consented", () => {
    const result = sanitizeSpanAttributes(
      { "context.mod_count": "73", "mod.fileCount": 10 },
      false,
    );
    expect(result).toEqual({ "context.mod_count": "73", "mod.fileCount": 10 });
  });
});

describe("sanitizeSpanAttributes (strict / no consent)", () => {
  it("drops attributes that are not allow-listed", () => {
    const result = sanitizeSpanAttributes({
      "context.value": "Animate Dead++.pak",
      "mod.baseName": "Animate Dead++.pak",
      "mod.modId": "Animate Dead++-1234-1-0",
      "mod.installerChoices": '{"plugin":"My Choice"}',
      "extension.archive": "MyExtension.7z",
      "deployment.modPath": "C:/Users/bob/AppData/Roaming/Vortex/skyrim/mods",
      "downloads.transfer.from": "C:/Users/bob/Downloads",
    });
    expect(result).toEqual({});
  });

  it("keeps allow-listed attributes and public Nexus ids", () => {
    const result = sanitizeSpanAttributes({
      "error.fingerprint": "deadbeef",
      "error.isCommunityExtension": true,
      componentStack: "\n    in Foo\n    in Bar",
      "mod.numericModId": "1234",
      "mod.fileId": "5678",
      "deployment.method": "hardlink",
      "context.gamemode": "Skyrim Special Edition",
    });
    expect(result).toEqual({
      "error.fingerprint": "deadbeef",
      "error.isCommunityExtension": true,
      componentStack: "\n    in Foo\n    in Bar",
      "mod.numericModId": "1234",
      "mod.fileId": "5678",
      "deployment.method": "hardlink",
      "context.gamemode": "Skyrim Special Edition",
    });
  });

  it("buckets count attributes (numbers and numeric strings)", () => {
    const result = sanitizeSpanAttributes({
      "context.mod_count": "73",
      "deployment.modCount": 120,
      "mod.fileCount": 10,
    });
    expect(result).toEqual({
      "context.mod_count": "51-100",
      "deployment.modCount": "101-150",
      "mod.fileCount": "0-50",
    });
  });

  it("redacts the OS username and tokenises well-known paths in string values", () => {
    const result = sanitizeSpanAttributes({
      "error.message": "ENOENT: 'C:\\Program Files\\Steam\\steamapps\\foo.esp'",
      "error.title": "open '/home/alice/game/mod.esp'",
    });
    expect(result["error.message"]).toBe("ENOENT: 'programfiles://Steam/steamapps/foo.esp'");
    expect(result["error.title"]).toContain("/home/<USER>/");
  });
});

describe("sanitizeResourceAttributes", () => {
  it("keeps known resource attributes and drops anything else", () => {
    const result = sanitizeResourceAttributes({
      "service.name": "vortex",
      "service.version": "2.3.0",
      "os.type": "Windows_NT",
      "telemetry.sdk.name": "opentelemetry",
      "host.name": "BOBS-GAMING-PC",
      "process.command_line": "C:/Users/bob/Vortex.exe",
    });
    expect(result).toEqual({
      "service.name": "vortex",
      "service.version": "2.3.0",
      "os.type": "Windows_NT",
      "telemetry.sdk.name": "opentelemetry",
    });
  });
});

const fakeSpan = (overrides: Partial<ReadableSpan> = {}): ReadableSpan =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  ({
    name: "mod.install",
    kind: 0,
    spanContext: () => ({ traceId: "t", spanId: "s", traceFlags: 1 }),
    parentSpanContext: undefined,
    startTime: [0, 0],
    endTime: [0, 0],
    status: { code: 2, message: "failed at C:\\Program Files\\Vortex\\app.asar\\x.js:1:2" },
    attributes: { "mod.baseName": "secret.pak", "mod.numericModId": "42" },
    links: [],
    events: [
      {
        name: "exception",
        time: [0, 0],
        attributes: {
          "exception.type": "Error",
          "exception.message": "boom in C:\\Users\\bob\\mod.pak",
          "exception.secret": "leak",
        },
      },
      { name: "log", time: [0, 0], attributes: { detail: "noise" } },
    ],
    duration: [0, 0],
    ended: true,
    resource: { attributes: { "service.name": "vortex", "host.name": "BOBS-PC" } },
    instrumentationScope: { name: "vortex" },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    ...overrides,
  }) as unknown as ReadableSpan;

describe("sanitizeSpan", () => {
  it("filters attributes, resource, status message and events", () => {
    const out = sanitizeSpan(fakeSpan());

    expect(out.attributes).toEqual({ "mod.numericModId": "42" });
    expect(out.resource.attributes).toEqual({ "service.name": "vortex" });
    expect(out.status.message).toBe("failed at app.asar/x.js:1:2");

    // Only the exception event survives, reduced to allow-listed fields.
    expect(out.events).toHaveLength(1);
    const event = out.events[0];
    expect(event?.name).toBe("exception");
    expect(event?.attributes).toEqual({
      "exception.type": "Error",
      "exception.message": "boom in C:/Users/<USER>/mod.pak",
    });
  });

  it("preserves span identity and timing", () => {
    const span = fakeSpan();
    const out = sanitizeSpan(span);
    expect(out.spanContext()).toEqual(span.spanContext());
    expect(out.name).toBe(span.name);
    expect(out.startTime).toBe(span.startTime);
  });

  it("keeps all attributes/events (string-redacted) and the resource allow-list when not strict", () => {
    const out = sanitizeSpan(fakeSpan(), false);
    // local mod name kept (consent), resource still allow-listed.
    expect(out.attributes).toEqual({ "mod.baseName": "secret.pak", "mod.numericModId": "42" });
    expect(out.resource.attributes).toEqual({ "service.name": "vortex" });
    // non-exception event retained, string values still redacted.
    expect(out.events).toHaveLength(2);
    const exception = out.events.find((e) => e.name === "exception");
    expect(exception?.attributes?.["exception.message"]).toBe("boom in C:/Users/<USER>/mod.pak");
  });
});

describe("SanitizingSpanExporter", () => {
  it("strict-sanitises before delegating when consent is absent (default)", () => {
    const inner = { export: vi.fn(), shutdown: vi.fn(), forceFlush: vi.fn() };
    const exporter = new SanitizingSpanExporter(inner);
    const cb = vi.fn();

    exporter.export([fakeSpan()], cb);

    expect(inner.export).toHaveBeenCalledTimes(1);
    const [forwarded, forwardedCb] = inner.export.mock.calls[0] ?? [];
    expect(forwardedCb).toBe(cb);
    expect(forwarded?.[0]?.attributes).toEqual({ "mod.numericModId": "42" });
  });

  it("keeps the richer payload when consent is given", () => {
    const inner = { export: vi.fn(), shutdown: vi.fn(), forceFlush: vi.fn() };
    const exporter = new SanitizingSpanExporter(inner, () => true);

    exporter.export([fakeSpan()], vi.fn());

    const forwarded = inner.export.mock.calls[0]?.[0];
    expect(forwarded?.[0]?.attributes).toEqual({
      "mod.baseName": "secret.pak",
      "mod.numericModId": "42",
    });
  });
});
