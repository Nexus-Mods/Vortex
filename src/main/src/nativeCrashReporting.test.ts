import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { gunzipSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const telemetry = vi.hoisted(() => ({
  getPath: vi.fn(),
  getVersion: vi.fn(),
  startSpan: vi.fn((_name: string, _options: { attributes: Record<string, unknown> }) => ({
    end: vi.fn(),
  })),
  forceFlush: vi.fn(async () => {}),
  shutdown: vi.fn(async () => {}),
  recordError: vi.fn(),
}));
vi.mock("electron", () => ({
  app: { getPath: telemetry.getPath, getVersion: telemetry.getVersion },
}));
vi.mock("./logging", () => ({ log: vi.fn() }));
vi.mock("./telemetry/setup", () => ({ COLLECTOR_URL: "http://localhost", OTLP_HEADERS: {} }));
vi.mock("./telemetry/state", () => ({ isTelemetryEnabled: () => false }));
vi.mock("@vortex/shared/telemetry", () => ({
  recordErrorOnSpan: telemetry.recordError,
  SanitizingSpanExporter: class {},
}));
vi.mock("./telemetry/resources", () => ({ createVortexResource: () => ({}) }));
vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({ OTLPTraceExporter: class {} }));
vi.mock("@opentelemetry/sdk-trace-base", () => ({
  SimpleSpanProcessor: class {},
  BasicTracerProvider: class {
    getTracer() {
      return { startSpan: telemetry.startSpan };
    }
    forceFlush = telemetry.forceFlush;
    shutdown = telemetry.shutdown;
  },
}));

import { sendPendingNativeCrashReport } from "./errorReporting";

describe("native crash startup sweep", () => {
  let root: string;
  beforeEach(async () => {
    vi.clearAllMocks();
    root = await mkdtemp(path.join(tmpdir(), "vortex-crash-sweep-"));
    telemetry.getPath.mockReturnValue(root);
    telemetry.getVersion.mockReturnValue("43.0.0");
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function dump(name: string, processType: string) {
    let buffer = gunzipSync(
      await readFile(path.join(__dirname, "__fixtures__", "windows-renderer.dmp.gz")),
    );
    // Append a length-prefixed annotation value and redirect only the
    // Crashpad annotation-object value RVAs for ptype/process_type.
    const value = Buffer.alloc(4 + Buffer.byteLength(processType));
    value.writeUInt32LE(Buffer.byteLength(processType));
    value.write(processType, 4);
    const directory = buffer.readUInt32LE(12);
    let replacements = 0;
    for (let i = 0; i < buffer.readUInt32LE(8); i++) {
      const stream = directory + i * 12;
      if (buffer.readUInt32LE(stream) !== 0x43500001) continue;
      const crashpad = buffer.readUInt32LE(stream + 8);
      const modules = buffer.readUInt32LE(crashpad + 48);
      if (modules === 0) continue;
      for (let j = 0; j < buffer.readUInt32LE(modules); j++) {
        const info = buffer.readUInt32LE(modules + 4 + j * 12 + 8);
        const annotations = buffer.readUInt32LE(info + 24);
        if (annotations === 0) continue;
        for (let k = 0; k < buffer.readUInt32LE(annotations); k++) {
          const entry = annotations + 4 + k * 12;
          const nameRva = buffer.readUInt32LE(entry);
          const name = buffer.toString(
            "utf8",
            nameRva + 4,
            nameRva + 4 + buffer.readUInt32LE(nameRva),
          );
          if (name !== "ptype" && name !== "process_type") continue;
          expect(buffer.readUInt16LE(entry + 4)).toBe(1); // string annotation
          buffer.writeUInt32LE(buffer.length, entry + 8);
          replacements += 1;
        }
      }
    }
    expect(replacements).toBeGreaterThan(0);
    buffer = Buffer.concat([buffer, value]);
    const file = path.join(root, "reports", name + ".dmp");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buffer);
    return file;
  }

  it("reports every process separately with its native crash site", async () => {
    await dump("main", "browser");
    await dump("renderer", "renderer");
    await dump("gpu", "gpu-process");
    await dump("utility", "utility");
    await sendPendingNativeCrashReport();
    const attributes = telemetry.startSpan.mock.calls.map((call) => call[1].attributes);
    expect(attributes).toHaveLength(4);
    for (const report of attributes) {
      expect(report).not.toHaveProperty("crash.native.dumpCount");
    }
    for (const [source, type] of [
      ["main", "browser"],
      ["renderer", "renderer"],
      ["gpu", "gpu-process"],
      ["utility", "utility"],
    ]) {
      expect(attributes).toContainEqual(
        expect.objectContaining({
          "crash.sourceProcess": source,
          "crash.native.processType": type,
          "crash.native.exceptionCode": "0xc0000005",
          "crash.native.module": "electron.exe",
          "crash.native.moduleOffset": "0x3aeaef0",
        }),
      );
    }
    expect(await readdir(path.join(root, "reports"))).toEqual([]);
  });

  it("names the crashed process in report titles and messages", async () => {
    await dump("main", "browser");
    await dump("renderer", "renderer");
    await dump("gpu", "gpu-process");
    await dump("utility", "utility");
    await sendPendingNativeCrashReport();
    const attributes = telemetry.recordError.mock.calls.map(
      (call) => call[4] as Record<string, unknown>,
    );
    for (const sourceProcess of ["main", "renderer", "gpu", "utility"]) {
      expect(attributes).toContainEqual(
        expect.objectContaining({ "error.title": `${sourceProcess} crash in electron.exe` }),
      );
    }
    const messages = telemetry.startSpan.mock.calls.map(
      (call) => call[1].attributes["error.message"],
    );
    for (const sourceProcess of ["main", "gpu", "renderer", "utility"]) {
      expect(messages).toContain(
        `${sourceProcess} crash from previous session: ACCESS_VIOLATION (0xc0000005) in electron.exe+0x3aeaef0`,
      );
    }
  });

  it("reports an unreadable reason and does not assume the main process", async () => {
    await writeFile(path.join(root, "broken.dmp"), Buffer.alloc(32));
    await sendPendingNativeCrashReport();
    expect(telemetry.startSpan.mock.calls[0]?.[1].attributes).toMatchObject({
      "crash.native.unreadableReason": "invalid-signature",
      "crash.sourceProcess": "unknown",
      "error.message": "unknown crash from previous session: unreadable crash dump",
    });
    expect(await readdir(root)).toEqual([]);
  });

  it("releases failed reports for retry while sending other dumps", async () => {
    await dump("gpu", "gpu-process");
    await dump("renderer", "renderer");
    telemetry.forceFlush.mockRejectedValueOnce(new Error("offline"));
    await sendPendingNativeCrashReport();
    expect(telemetry.startSpan).toHaveBeenCalledTimes(2);
    const remaining = await readdir(path.join(root, "reports"));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatch(/\.dmp$/);
    await sendPendingNativeCrashReport();
    expect(await readdir(path.join(root, "reports"))).toEqual([]);
  });

  it("discards other builds and DumpWithoutCrashing reports", async () => {
    await mkdir(path.join(root, "reports"), { recursive: true });
    await writeFile(
      path.join(root, "reports", "old.dmp"),
      gunzipSync(await readFile(path.join(__dirname, "__fixtures__", "linux-main.dmp.gz"))),
    ); // appVersion 1.0.0
    const file = await dump("diagnostic", "gpu-process");
    const buffer = await readFile(file);
    const directory = buffer.readUInt32LE(12);
    for (let i = 0; i < buffer.readUInt32LE(8); i++) {
      const entry = directory + i * 12;
      if (buffer.readUInt32LE(entry) === 6) {
        buffer.writeUInt32LE(0x0517a7ed, buffer.readUInt32LE(entry + 8) + 8);
      }
    }
    await writeFile(file, buffer);
    await sendPendingNativeCrashReport();
    expect(telemetry.startSpan).not.toHaveBeenCalled();
    expect(await readdir(path.join(root, "reports"))).toEqual([]);
  });

  it("skips active claims and recovers stale claims", async () => {
    const active = path.join(root, "active.dmp.sending");
    const stale = path.join(root, "stale.dmp.sending");
    await writeFile(active, Buffer.alloc(32));
    await writeFile(stale, Buffer.alloc(32));
    const old = new Date(Date.now() - 10 * 60 * 1000);
    await utimes(stale, old, old);
    await sendPendingNativeCrashReport();
    expect(telemetry.startSpan).toHaveBeenCalledTimes(1);
    expect(await readdir(root)).toEqual(["active.dmp.sending"]);
  });

  it("limits startup reporting to the newest five dumps", async () => {
    for (let i = 0; i < 7; i++) {
      await dump(String(i), "renderer");
    }
    await sendPendingNativeCrashReport();
    expect(telemetry.startSpan).toHaveBeenCalledTimes(5);
    expect(await readdir(path.join(root, "reports"))).toEqual([]);
  });
});
