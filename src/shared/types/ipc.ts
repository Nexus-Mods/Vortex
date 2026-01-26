/** Type containing all known channels used by renderer processes to send messages to the main process */
export interface RendererChannels {}

/** Type containing all known channels used by the main process to send messages to a renderer process */
export interface MainChannels {}

/** Type containing all known channels used by renderer processes to send to and receive messages from the main process */
export interface InvokeChannels {}

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
  | { [key: number]: Serializable }
  | Map<Serializable, Serializable>
  | Set<Serializable>
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | TypedArray;

// NOTE(erri120): Alternative is using `never` in the fallback but that doesn't produce very nice error messages.
/** Utility type to assert that the type is serializable */
export type AssertSerializable<T> = T extends Serializable
  ? T
  : { __error__: "Type is not serializable for IPC" };

/** Utility type to check all args are serializable */
export type SerializableArgs<T extends readonly unknown[]> = {
  [K in keyof T]: AssertSerializable<T[K]>;
};
