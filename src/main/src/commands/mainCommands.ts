import { setupCommandIPC } from "./commandIPC";
import { CommandRegistry } from "./CommandRegistry";

const mainCommands = new CommandRegistry();
let ipcReady = false;

export function getMainCommands(): CommandRegistry {
  if (!ipcReady) {
    setupCommandIPC(mainCommands);
    ipcReady = true;
  }

  return mainCommands;
}
