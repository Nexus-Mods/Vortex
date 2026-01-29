// NOTE(erri120): This file serves as the backbone for proper IPC usage.
// Everything in here is compile-time only, meaning the interfaces you find here
// are never used to create an object. They are only used for type inferrence.

import type { Level } from "./logging";

// NOTE(erri120): You should use unique channel names to prevent overlap. You can prefix
// channel names with an "area" like "example:" to somewhat categorize them and reduce the possibility of overlap.

/** Type containing all known channels used by renderer processes to send messages to the main process */
export interface RendererChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be void.

  /** Logs a message */
  "logging:log": (level: Level, message: string, metadata?: string) => void;

  // Examples:
  "example:renderer_foo": () => void;
  "example:renderer_bar": (data: number) => void;
}

/** Type containing all known channels used by the main process to send messages to a renderer process */
export interface MainChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be void.

  // Examples:
  "example:main_foo": () => void;
  "example:main_bar": (data: string) => void;
}

/** Type containing all known channels used by renderer processes to send to and receive messages from the main process */
export interface InvokeChannels {
  // NOTE(erri120): Parameters must be serializable and return values must be Promises resolving serializable content.

  // Examples:
  "example:ping": () => Promise<string>;
}

/** Represents all IPC-safe typed arrays */
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

/** Represents all IPC-safe types */
export type Serializable =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Date
  | Serializable[]
  | { [key: string]: Serializable }
  | Map<Serializable, Serializable>
  | Set<Serializable>
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | TypedArray;

// NOTE(erri120): If you found this type because you got an error, that means you're trying to pass data across the IPC
// that can't be serialized. Check the list of supported types above and pick one of them. If you think there is a type missing
// from the list above, write a small proof and we can discuss it.

// NOTE(erri120): Alternative is using `never` in the fallback but that doesn't produce very nice error messages.
/** Utility type to assert that the type is serializable */
export type AssertSerializable<T> = T extends Serializable
  ? T
  : { __error__: "Type is not serializable for IPC" };

/** Utility type to check all args are serializable */
export type SerializableArgs<T extends readonly unknown[]> = {
  [K in keyof T]: AssertSerializable<T[K]>;
};
