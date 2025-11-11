import * as net from 'net';
import * as path from 'path';
import * as os from 'os';
import { log } from '../../../util/log';
import { ITransport, TransportType, TransportError, TransportServerCreatedCallback } from './ITransport';

/**
 * Named Pipe transport implementation for Windows
 * Unix Domain Socket implementation for Linux/Mac
 *
 * IMPORTANT: Uses TWO separate pipes for Windows compatibility:
 * - Outbound pipe (server → client): {pipeId}
 * - Inbound pipe (client → server): {pipeId}_reply
 *
 * This matches the C# ModInstallerIPC.exe implementation which expects
 * separate read/write pipes on Windows.
 *
 * Pros:
 * - Faster than TCP (kernel-level IPC, no network stack)
 * - No firewall/antivirus interference
 * - Better security (OS-level ACLs)
 * - Supports Windows App Container permissions
 *
 * Cons:
 * - Platform-specific paths
 * - Slightly more complex than TCP
 * - Harder to debug without specialized tools
 */
export class NamedPipeTransport implements ITransport {
  public readonly type = TransportType.NamedPipe;

  private socketOut: net.Socket | null = null;  // Outbound socket (Node writes, C# reads)
  private socketIn: net.Socket | null = null;   // Inbound socket (C# writes, Node reads)
  private pipePathOut: string | null = null;
  private pipePathIn: string | null = null;
  private disposed = false;
  private pipeId: string | null = null;
  private receiveBuffer: string = '';
  private messageHandler: ((message: string) => void) | null = null;
  private dataListener: ((data: string) => void) | null = null;
  private errorListener: ((err: Error) => void) | null = null;
  private closeListener: (() => void) | null = null;

  /**
   * Named pipes are available on Windows, Unix sockets on Linux/Mac
   */
  public isAvailable(): boolean {
    // Named pipes on Windows, Unix sockets on Linux/Mac
    return process.platform === 'win32' ||
      process.platform === 'linux' ||
      process.platform === 'darwin';
  }

  /**
   * Get command-line arguments for the child process
   */
  public getProcessArgs(pipeId: string): string[] {
    if (process.platform === 'win32') {
      // Pass pipe name (without \\.\pipe\ prefix) to Windows process
      return ['--pipe', pipeId];
    } else {
      // Pass full socket path to Unix process
      return ['--socket', this.getPipePath(pipeId)];
    }
  }

  /**
   * Get the pipe paths for external configuration (e.g., ACL setup)
   * Returns both outbound and inbound pipe paths
   * @returns Object with outbound and inbound pipe paths, or null if not initialized
   */
  public getPipePaths(): { outbound: string; inbound: string } | null {
    if (!this.pipePathOut || !this.pipePathIn) {
      return null;
    }
    return {
      outbound: this.pipePathOut,
      inbound: this.pipePathIn
    };
  }

  /**
   * Initialize named pipe/Unix socket servers
   * Node.js creates pipe SERVERS, C# process connects as CLIENT
   * @returns Pipe identifier (name without path)
   */
  public async initialize(): Promise<string> {
    if (this.disposed) {
      throw new TransportError(
        this.type,
        'Cannot initialize disposed transport'
      );
    }

    this.pipeId = this.generatePipeId();
    // IMPORTANT: Pipe direction from C# perspective (it's the one naming them):
    // - Base pipe (pipeId): C# reads (PipeDirection.In), Node writes (outbound from Node's perspective)
    // - Reply pipe (pipeId_reply): C# writes (PipeDirection.Out), Node reads (inbound from Node's perspective)
    this.pipePathOut = this.getPipePath(this.pipeId);       // Node writes, C# reads
    this.pipePathIn = this.getPipePath(this.pipeId + '_reply'); // C# writes, Node reads

    log('debug', 'Named pipe transport initialized (outbound)', {
      pipePath: this.pipePathOut,
      platform: process.platform
    });

    log('debug', 'Named pipe transport initialized (inbound)', {
      pipePath: this.pipePathIn,
      platform: process.platform
    });

    return this.pipeId;
  }

  // Store server references for cleanup
  private serverOut: net.Server | null = null;
  private serverIn: net.Server | null = null;
  private connectionResolve: (() => void) | null = null;
  private connectionReject: ((err: Error) => void) | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;

  /**
   * Create named pipe servers and start listening
   * This must be called BEFORE launching the C# process so the pipes exist for permission configuration
   * Node.js creates SERVERS, C# process connects as CLIENT
   * @param onCreated Optional callback invoked after servers are created, with the pipe ID
   */
  public async createServers(onCreated?: TransportServerCreatedCallback): Promise<void> {
    if (!this.pipePathOut || !this.pipePathIn) {
      throw new TransportError(
        this.type,
        'Transport not initialized'
      );
    }

    log('debug', 'Creating named pipe servers', {
      pipePathOut: this.pipePathOut,
      pipePathIn: this.pipePathIn
    });

    // Create servers
    this.serverOut = net.createServer();
    this.serverIn = net.createServer();

    try {
      // Start listening on both pipes
      await new Promise<void>((resolve, reject) => {
        this.serverOut!.listen(this.pipePathOut, () => {
          log('debug', 'Outbound pipe server listening', { pipePath: this.pipePathOut });
          resolve();
        });
        this.serverOut!.on('error', reject);
      });

      await new Promise<void>((resolve, reject) => {
        this.serverIn!.listen(this.pipePathIn, () => {
          log('debug', 'Inbound pipe server listening', { pipePath: this.pipePathIn });
          resolve();
        });
        this.serverIn!.on('error', reject);
      });

      log('info', 'Named pipe servers created and listening', {
        pipePathOut: this.pipePathOut,
        pipePathIn: this.pipePathIn
      });

      // Invoke the callback after servers are created to allow permission configuration
      if (onCreated && this.pipeId) {
        log('debug', 'Invoking onCreated callback', { pipeId: this.pipeId });
        await onCreated(this.pipeId);
        log('debug', 'onCreated callback completed');
      }
    } catch (err) {
      this.serverOut?.close();
      this.serverIn?.close();
      this.serverOut = null;
      this.serverIn = null;
      throw err;
    }
  }

  /**
   * Wait for the C# process to connect to the named pipe servers
   * Must be called AFTER launching the process
   */
  public async waitForConnection(timeout: number): Promise<void> {
    if (!this.serverOut || !this.serverIn) {
      throw new TransportError(
        this.type,
        'Servers not created. Call createServers() first.'
      );
    }

    log('debug', 'Waiting for C# client to connect to pipe servers', { timeout });

    // Set up connection tracking
    let outboundConnected = false;
    let inboundConnected = false;

    const checkBothConnected = () => {
      if (outboundConnected && inboundConnected) {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }

        log('info', 'Named pipe transport fully connected', {
          pipePathOut: this.pipePathOut,
          pipePathIn: this.pipePathIn,
          socketOutDestroyed: this.socketOut?.destroyed,
          socketInDestroyed: this.socketIn?.destroyed
        });

        // IMPORTANT: Do NOT close the servers yet!
        // On Windows, closing a named pipe server also closes all connected sockets.
        // We must keep the servers alive until dispose() is called.
        // The servers will be cleaned up in dispose() after we're done with the sockets.
        log('debug', 'Named pipe servers will remain open until dispose()', {
          socketOutDestroyed: this.socketOut?.destroyed,
          socketInDestroyed: this.socketIn?.destroyed,
          socketOutReadable: this.socketOut?.readable,
          socketOutWritable: this.socketOut?.writable,
          socketInReadable: this.socketIn?.readable,
          socketInWritable: this.socketIn?.writable
        });

        // Delay resolving the promise slightly to allow spurious test connections to close
        // Windows test connections typically close within 1-5ms
        setTimeout(() => {
          // Double-check that both sockets are still connected
          if (this.socketOut && !this.socketOut.destroyed && this.socketIn && !this.socketIn.destroyed) {
            log('debug', 'Connection stable, resolving promise');
            if (this.connectionResolve) {
              this.connectionResolve();
              this.connectionResolve = null;
              this.connectionReject = null;
            }
          } else {
            log('info', 'Connections closed before stabilizing, waiting for new connections', {
              socketOutAlive: this.socketOut && !this.socketOut.destroyed,
              socketInAlive: this.socketIn && !this.socketIn.destroyed
            });
          }
        }, 10); // 10ms delay to detect test connections
      }
    };

    // Set up connection handlers
    this.serverOut.on('connection', (socket) => {
      log('debug', 'Outbound server received connection', {
        pipePath: this.pipePathOut,
        socketDestroyed: socket.destroyed,
        socketReadable: socket.readable,
        socketWritable: socket.writable,
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        existingSocket: !!this.socketOut
      });

      // If we already have a socket, this is a spurious connection - reject it
      if (this.socketOut) {
        log('warn', 'Rejecting duplicate outbound connection', {
          pipePath: this.pipePathOut
        });
        socket.destroy();
        return;
      }

      this.socketOut = socket;
      this.socketOut.setEncoding('utf8');

      this.socketOut.on('close', (hadError) => {
        log('warn', 'Outbound socket closed', {
          hadError,
          pipePath: this.pipePathOut,
          wasConnected: outboundConnected,
          connectionResolved: !this.connectionResolve,
          stack: new Error().stack
        });

        // If the socket closes before the connection promise has been resolved,
        // reset and wait for a new connection (this handles Windows test connections)
        // The connectionResolve is set to null when checkBothConnected() resolves the promise
        if (this.connectionResolve !== null) {
          log('info', 'Outbound socket closed before connection established, waiting for new connection', {
            pipePath: this.pipePathOut,
            outboundConnected,
            inboundConnected
          });
          this.socketOut = null;
          outboundConnected = false;
        }
      });

      this.socketOut.on('error', (err) => {
        log('error', 'Outbound socket error', { error: err.message, pipePath: this.pipePathOut });
      });

      log('debug', 'Named pipe outbound connected', {
        pipePath: this.pipePathOut,
        socketDestroyed: socket.destroyed,
        socketReadable: socket.readable,
        socketWritable: socket.writable
      });

      outboundConnected = true;
      checkBothConnected();
    });

    this.serverIn.on('connection', (socket) => {
      log('debug', 'Inbound server received connection', {
        pipePath: this.pipePathIn,
        socketDestroyed: socket.destroyed,
        socketReadable: socket.readable,
        socketWritable: socket.writable,
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        existingSocket: !!this.socketIn
      });

      // If we already have a socket, this is a spurious connection - reject it
      if (this.socketIn) {
        log('warn', 'Rejecting duplicate inbound connection', {
          pipePath: this.pipePathIn
        });
        socket.destroy();
        return;
      }

      this.socketIn = socket;
      this.socketIn.setEncoding('utf8');

      this.socketIn.on('close', (hadError) => {
        log('warn', 'Inbound socket closed', {
          hadError,
          pipePath: this.pipePathIn,
          wasConnected: inboundConnected,
          connectionResolved: !this.connectionResolve,
          stack: new Error().stack
        });

        // If the socket closes before the connection promise has been resolved,
        // reset and wait for a new connection (this handles Windows test connections)
        // The connectionResolve is set to null when checkBothConnected() resolves the promise
        if (this.connectionResolve !== null) {
          log('info', 'Inbound socket closed before connection established, waiting for new connection', {
            pipePath: this.pipePathIn,
            outboundConnected,
            inboundConnected
          });
          this.socketIn = null;
          inboundConnected = false;
        }
      });

      this.socketIn.on('error', (err) => {
        log('error', 'Inbound socket error', { error: err.message, pipePath: this.pipePathIn });
      });

      log('debug', 'Named pipe inbound connected', {
        pipePath: this.pipePathIn,
        socketDestroyed: socket.destroyed,
        socketReadable: socket.readable,
        socketWritable: socket.writable
      });

      inboundConnected = true;
      checkBothConnected();
    });

    // Wait for both connections with timeout
    return new Promise<void>((resolve, reject) => {
      this.connectionResolve = resolve;
      this.connectionReject = reject;

      this.connectionTimeout = setTimeout(() => {
        // Don't close servers here - they'll be cleaned up in dispose()
        this.connectionResolve = null;
        this.connectionReject = null;

        reject(new TransportError(
          this.type,
          `Timeout waiting for named pipe connections after ${timeout}ms`
        ));
      }, timeout);
    });
  }

  /**
   * Read and validate the initial handshake from the connected process
   */
  public async readHandshake(timeout: number): Promise<string> {
    if (!this.socketIn) {
      throw new TransportError(
        this.type,
        'No inbound socket available for handshake'
      );
    }

    return new Promise<string>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.socketIn!.removeListener('data', onData);
        reject(new TransportError(
          this.type,
          'Timeout waiting for handshake'
        ));
      }, timeout);

      const onData = (data: string) => {
        if (data.startsWith('connected')) {
          clearTimeout(timeoutHandle);
          this.socketIn!.removeListener('data', onData);

          // Preserve any data after "connected" in the receive buffer
          const afterHandshake = data.substring('connected'.length);
          if (afterHandshake.length > 0) {
            log('debug', 'Preserved data after handshake', {
              length: afterHandshake.length
            });
          }

          resolve(afterHandshake);
        }
      };

      this.socketIn!.on('data', onData);
    });
  }

  /**
   * Send a message through the transport (uses outbound socket)
   */
  public async sendMessage(message: string): Promise<void> {
    log('debug', 'sendMessage called', {
      hasSocketOut: !!this.socketOut,
      isDestroyed: this.socketOut?.destroyed,
      disposed: this.disposed
    });

    if (!this.socketOut || this.socketOut.destroyed) {
      throw new TransportError(
        this.type,
        'Named pipe outbound connection is not active'
      );
    }

    const data = message + '\uFFFF';

    log('debug', 'Sending named pipe message', {
      length: data.length
    });

    return new Promise<void>((resolve, reject) => {
      this.socketOut!.write(data, 'utf8', (err) => {
        if (err) {
          reject(new TransportError(
            this.type,
            `Failed to send message: ${err.message}`,
            err
          ));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Start listening for incoming messages (uses inbound socket)
   */
  public startReceiving(handler: (message: string) => void): void {
    if (!this.socketIn) {
      throw new TransportError(
        this.type,
        'No inbound socket available for receiving'
      );
    }

    this.messageHandler = handler;

    this.dataListener = (data: string) => {
      this.receiveBuffer += data;

      // Process complete messages (delimited by \uFFFF)
      while (this.receiveBuffer.includes('\uFFFF')) {
        const delimiterIndex = this.receiveBuffer.indexOf('\uFFFF');
        const messageText = this.receiveBuffer.substring(0, delimiterIndex);
        this.receiveBuffer = this.receiveBuffer.substring(delimiterIndex + 1);

        if (messageText.length > 0 && this.messageHandler) {
          this.messageHandler(messageText);
        }
      }
    };

    this.errorListener = (err: Error) => {
      log('error', 'Named pipe socket error', { error: err.message });
    };

    this.closeListener = () => {
      log('info', 'Named pipe socket closed');
    };

    this.socketIn.on('data', this.dataListener);
    this.socketIn.on('error', this.errorListener);
    this.socketIn.on('close', this.closeListener);

    log('debug', 'Started receiving named pipe messages');
  }

  /**
   * Stop listening for messages
   */
  public stopReceiving(): void {
    if (this.socketIn && this.dataListener) {
      this.socketIn.removeListener('data', this.dataListener);
      this.socketIn.removeListener('error', this.errorListener!);
      this.socketIn.removeListener('close', this.closeListener!);

      this.dataListener = null;
      this.errorListener = null;
      this.closeListener = null;
      this.messageHandler = null;

      log('debug', 'Stopped receiving named pipe messages');
    }
  }

  /**
   * Clean up resources
   */
  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop receiving messages
    this.stopReceiving();

    // Close sockets first
    if (this.socketOut && !this.socketOut.destroyed) {
      this.socketOut.destroy();
      this.socketOut = null;
    }

    if (this.socketIn && !this.socketIn.destroyed) {
      this.socketIn.destroy();
      this.socketIn = null;
    }

    // Now close the servers (if they're still open)
    if (this.serverOut) {
      this.serverOut.close();
      this.serverOut = null;
    }

    if (this.serverIn) {
      this.serverIn.close();
      this.serverIn = null;
    }

    // Clear any pending connection promises
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    this.connectionResolve = null;
    this.connectionReject = null;

    // Clean up Unix socket files if they exist
    if (process.platform !== 'win32') {
      const fs = require('fs');

      if (this.pipePathOut) {
        try {
          if (fs.existsSync(this.pipePathOut)) {
            fs.unlinkSync(this.pipePathOut);
          }
        } catch (err) {
          log('warn', 'Failed to clean up outbound Unix socket file', {
            path: this.pipePathOut,
            error: err.message
          });
        }
      }

      if (this.pipePathIn) {
        try {
          if (fs.existsSync(this.pipePathIn)) {
            fs.unlinkSync(this.pipePathIn);
          }
        } catch (err) {
          log('warn', 'Failed to clean up inbound Unix socket file', {
            path: this.pipePathIn,
            error: err.message
          });
        }
      }
    }

    log('debug', 'Named pipe transport disposed');

    // Clear buffer
    this.receiveBuffer = '';
    this.pipePathOut = null;
    this.pipePathIn = null;
    this.pipeId = null;
  }

  /**
   * Generate a unique pipe identifier
   */
  private generatePipeId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `vortex-fomod-${timestamp}-${random}`;
  }

  /**
   * Get the platform-specific pipe path
   */
  private getPipePath(pipeId: string): string {
    if (process.platform === 'win32') {
      // Windows Named Pipe format: \\.\pipe\name
      return `\\\\.\\pipe\\${pipeId}`;
    } else {
      // Unix Domain Socket format: /tmp/name.sock
      // Use user-specific temp to avoid permission issues
      const tmpDir = os.tmpdir();
      return path.join(tmpDir, `${pipeId}.sock`);
    }
  }

}
