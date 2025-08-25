"use strict";

// Minimal shim that satisfies imports on non-Windows dev machines.
// It provides createIPC() and killProcess() with no-op semantics that
// keep the app wiring alive without spawning native helpers.

async function createIPC(options) {
  const handle = {
    pid: process.pid,
    async stop() { /* no-op for mac shim */ }
  };
  return handle;
}

async function killProcess(pid) {
  // Be conservative: don't actually kill anything in the shim.
  // In real Windows builds, the native impl handles this.
  void pid;
  return;
}

module.exports = { createIPC, killProcess };