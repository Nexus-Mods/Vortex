import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";
import winston from "winston";

vi.mock("./ipc", () => ({ betterIpcMain: { on: vi.fn() } }));

import { dropConsoleOnBrokenPipe } from "./logging";

function makeLogger(): winston.LoggerInstance {
  return new winston.Logger({ transports: [new winston.transports.Console({ silent: true })] });
}

function pipeError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: broken pipe, write`), { code });
}

describe("dropConsoleOnBrokenPipe", () => {
  it("stops logging to a console whose pipe broke", () => {
    const logger = makeLogger();
    const stdout = new EventEmitter();
    dropConsoleOnBrokenPipe(logger, [stdout]);

    stdout.emit("error", pipeError("EPIPE"));

    expect(logger.transports["console"]).toBeUndefined();
  });

  it("handles the error, so it doesn't reach the uncaught error handler", () => {
    const logger = makeLogger();
    const stderr = new EventEmitter();
    dropConsoleOnBrokenPipe(logger, [stderr]);

    // an emitter without an error listener throws
    expect(() => stderr.emit("error", pipeError("EPIPE"))).not.toThrow();
    expect(() => stderr.emit("error", pipeError("EPIPE"))).not.toThrow();
  });

  it("keeps the console for other stream errors", () => {
    const logger = makeLogger();
    const stdout = new EventEmitter();
    dropConsoleOnBrokenPipe(logger, [stdout]);

    stdout.emit("error", pipeError("EAGAIN"));

    expect(logger.transports["console"]).toBeDefined();
  });
});
