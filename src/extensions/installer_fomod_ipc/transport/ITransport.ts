/**
 * Callback invoked after transport servers are created
 * Provides an opportunity to configure permissions, ACLs, etc.
 * @param connectionId The connection identifier (pipe name, port, etc.)
 */
export type TransportServerCreatedCallback = (connectionId: string) => void | Promise<void>;

/**
 * Transport mechanism for IPC communication with ModInstallerIPC.exe
 * Abstracts the underlying communication channel (TCP, Named Pipes, Unix Sockets)
 */
export interface ITransport {
  /**
   * The type of transport mechanism
   */
  readonly type: TransportType;

  /**
   * Initialize the transport and start listening for connections
   * @returns Connection identifier (port number, pipe name, etc.)
   */
  initialize(): Promise<string>;

  /**
   * Create servers and start listening (optional, for named pipes)
   * For named pipes, this must be called before launching the process
   * so the pipes exist for permission configuration
   * @param onCreated Optional callback invoked after servers are created,
   *                  useful for configuring permissions/ACLs before process launch
   */
  createServers?(onCreated?: TransportServerCreatedCallback): Promise<void>;

  /**
   * Wait for the client process to connect
   * @param timeout Maximum time to wait in milliseconds
   */
  waitForConnection(timeout: number): Promise<void>;

  /**
   * Get the connection arguments to pass to the child process
   * @param connectionId The identifier returned by initialize()
   */
  getProcessArgs(connectionId: string): string[];

  /**
   * Read and validate the initial handshake from the connected process
   * Should consume "connected" message and preserve any trailing data
   * @param timeout Maximum time to wait in milliseconds
   * @returns Buffer content after handshake (may be empty)
   */
  readHandshake(timeout: number): Promise<string>;

  /**
   * Send a message through the transport
   * Handles encoding and any transport-specific requirements
   * @param message The message to send (will be delimited automatically)
   */
  sendMessage(message: string): Promise<void>;

  /**
   * Start listening for incoming messages
   * Should call the handler for each complete message received
   * @param handler Callback for each complete message
   */
  startReceiving(handler: (message: string) => void): void;

  /**
   * Stop listening for messages and clean up event handlers
   */
  stopReceiving(): void;

  /**
   * Clean up resources (close server, sockets, etc.)
   */
  dispose(): Promise<void>;

  /**
   * Whether this transport is available on the current platform
   */
  isAvailable(): boolean;
}

/**
 * Transport type enumeration
 */
export enum TransportType {
  TCP = 'tcp',
  NamedPipe = 'named_pipe',
  UnixSocket = 'unix_socket',
}

/**
 * Base error for transport-related failures
 */
export class TransportError extends Error {
  constructor(
    public readonly transportType: TransportType,
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'TransportError';
  }
}
