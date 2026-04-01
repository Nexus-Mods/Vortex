import type { Serializable } from "@vortex/shared/ipc";

export type CommandPayload = Record<string, Serializable> | undefined;

export type CommandHandler<TPayload extends CommandPayload = CommandPayload> = (
  payload: TPayload,
) => Promise<void> | void;

export class CommandRegistry {
  #mHandlers: Map<string, CommandHandler> = new Map();

  public register<TPayload extends CommandPayload>(
    name: string,
    handler: CommandHandler<TPayload>,
  ): void {
    if (this.#mHandlers.has(name)) {
      throw new Error(`Command already registered: '${name}'`);
    }

    this.#mHandlers.set(name, handler as CommandHandler);
  }

  public async execute(
    name: string,
    payload?: Record<string, Serializable>,
  ): Promise<void> {
    const handler = this.#mHandlers.get(name);
    if (handler === undefined) {
      throw new Error(`Unknown command: '${name}'`);
    }

    const result = await handler(payload);
    if (result !== undefined) {
      throw new Error(`Command '${name}' must not return data`);
    }
  }
}
