import type { CommandRegistry } from "./CommandRegistry";

import { betterIpcMain } from "../ipc";

export function setupCommandIPC(registry: CommandRegistry): void {
  betterIpcMain.handle("command:execute", async (_event, commandName, payload) =>
    registry.execute(commandName, payload),
  );
}
