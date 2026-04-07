import type { AdaptorName, MessageId, PID, SemVer, URI } from "./types/branded.js";

// --- Messages ---

/**
 * A typed message envelope sent between host and adaptor services.
 * @template T - The type of the message payload.
 */
export interface IMessage<T = unknown> {
  /** Service URI identifying the message type. */
  type: URI;
  /** Unique message ID for correlation. */
  id: MessageId;
  /** PID of the sender for routing replies. */
  replyTo?: PID;
  /** Message body. */
  payload: T;
}

/**
 * Handles incoming messages of type TReq and returns TRes.
 * The fundamental unit of service communication.
 * @template TReq - The request payload type.
 * @template TRes - The response type.
 */
export type IMessageHandler<TReq = unknown, TRes = unknown> = (
  message: IMessage<TReq>,
) => Promise<TRes>;

// --- Service proxy (returned by resolve) ---

/**
 * Lightweight proxy returned by IServiceResolver.resolve().
 * Wraps message dispatch behind a single send() method.
 */
export interface IServiceProxy {
  send(payload: unknown): Promise<unknown>;
}

// --- Runtime (injected by host) ---

/**
 * Runtime environment injected into an adaptor's activate() method.
 * Provides access to service resolution and handler registration.
 */
export interface IAdaptorRuntime {
  /** Resolve dependencies by service URI. */
  services: IServiceResolver;
  /** Register provided message handlers. */
  handlers: IHandlerRegistry;
}

/**
 * Resolves service URIs to callable proxies.
 */
export interface IServiceResolver {
  resolve(name: URI): IServiceProxy;
}

/**
 * Registers message handlers addressable by URI.
 */
export interface IHandlerRegistry {
  register(name: URI, handler: IMessageHandler): void;
}

// --- Manifest ---

/**
 * Metadata returned by IAdaptorModule.activate() describing what the adaptor provides and requires.
 */
export interface IAdaptorManifest {
  /** Unique URI identifying this adaptor. */
  id: URI;
  /** Human-readable adaptor name. */
  name: AdaptorName;
  /** SemVer version string. */
  version: SemVer;
  /** URIs this adaptor handles. */
  provides: URI[];
  /** URIs this adaptor depends on. */
  requires: URI[];
}

// --- Service Registry (augmented by contract files via declare module) ---

/**
 * Maps service URIs to their typed interfaces.
 * Contract files augment this via declare module.
 *
 * @example
 * ```ts
 * declare module "@vortex/adaptor-api" {
 *   interface ServiceRegistry {
 *     "vortex:host/ping": PingService;
 *   }
 * }
 * ```
 */
export interface ServiceRegistry {}

/**
 * Maps friendly alias names to their full service URIs.
 */
export interface ServiceAliases {}

/**
 * Looks up the service interface type for a given URI string.
 * @template K - A service URI string key.
 */
export type ServiceFor<K extends string> = K extends keyof ServiceRegistry ? ServiceRegistry[K] : unknown;

// --- Method Message ---

/**
 * Method-level RPC message used by createServiceProxy and createMethodDispatcher.
 * Encodes which method to call and with what arguments.
 */
export interface IMethodMessage {
  /** Target service URI. */
  uri: string;
  /** Method name to invoke. */
  method: string;
  /** Positional arguments to pass. */
  args: unknown[];
}
