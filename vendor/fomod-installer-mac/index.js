"use strict";

// mac-dev shim matching the project's expected surface:
// - createIPC(...) returns a Promise<number> (pid)
// - killProcess(pid) resolves (no-op here)

async function createIPC(/* pipe, ipcId, onExit, onStdout, containerName, debug */) {
  return process.pid;
}

async function killProcess(pid) {
  void pid; // no-op
  return;
}

module.exports = { createIPC, killProcess };
