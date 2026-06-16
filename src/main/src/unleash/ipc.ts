import { betterIpcMain } from "../ipc";
import type { UnleashClient } from "./client";

export function init(client: UnleashClient): void {
  betterIpcMain.handle("flags:get", () => {
    return client.flags;
  });
}
