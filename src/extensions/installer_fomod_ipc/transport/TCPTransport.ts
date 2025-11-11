import * as net from 'net';
import { log } from '../../../util/log';
import { ITransport, TransportType, TransportError } from './ITransport';

/**
 * TCP socket-based transport implementation
 * Uses localhost TCP connections for IPC communication
 *
 * Pros:
 * - Cross-platform compatible
 * - Easy to debug (netstat, Wireshark)
 * - Simple implementation
 *
 * Cons:
 * - May be blocked by firewalls/antivirus
 * - Slower than named pipes (TCP/IP stack overhead)
 * - Less secure (exposed to network layer)
 */
export class TCPTransport implements ITransport {
  public readonly type = TransportType.TCP;

  private server: net.Server | null = null;
  private clientSocket: net.Socket | null = null;
  private disposed = false;
  private receiveBuffer: string = '';
  private messageHandler: ((message: string) => void) | null = null;
  private dataListener: ((data: string) => void) | null = null;
  private errorListener: ((err: Error) => void) | null = null;
  private closeListener: (() => void) | null = null;

  /**
   * TCP is available on all platforms
   */
  public isAvailable(): boolean {
    return true;
  }

  /**
   * Get command-line arguments for the child process
   */
  public getProcessArgs(port: string): string[] {
    return ['--port', port];
  }

  /**
   * Initialize TCP server on a random available port
   * @returns Port number as string
   */
  public async initialize(): Promise<string> {
    if (this.disposed) {
      throw new TransportError(
        this.type,
        'Cannot initialize disposed transport'
      );
    }

    this.server = net.createServer();

    try {
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(0, '127.0.0.1', () => {
          log('debug', 'TCP transport initialized', {
            port: (this.server!.address() as net.AddressInfo).port
          });
          resolve();
        });

        this.server!.on('error', (err) => {
          reject(new TransportError(
            this.type,
            `Failed to start TCP server: ${err.message}`,
            err
          ));
        });
      });

      const address = this.server.address() as net.AddressInfo;
      return address.port.toString();
    } catch (err) {
      this.dispose();
      throw err;
    }
  }

  /**
   * Wait for the client process to connect
   */
  public async waitForConnection(timeout: number): Promise<void> {
    if (!this.server) {
      throw new TransportError(
        this.type,
        'Transport not initialized'
      );
    }

    return new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.server!.removeListener('connection', onConnection);
        reject(new TransportError(
          this.type,
          `Timeout waiting for TCP connection after ${timeout}ms`
        ));
      }, timeout);

      const onConnection = (socket: net.Socket) => {
        clearTimeout(timeoutHandle);
        this.clientSocket = socket;
        this.clientSocket.setEncoding('utf8');

        log('debug', 'TCP client connected', {
          remoteAddress: socket.remoteAddress,
          remotePort: socket.remotePort
        });

        resolve();
      };

      this.server!.once('connection', onConnection);
    });
  }

  /**
   * Read and validate the initial handshake from the connected process
   */
  public async readHandshake(timeout: number): Promise<string> {
    if (!this.clientSocket) {
      throw new TransportError(
        this.type,
        'No client socket available for handshake'
      );
    }

    return new Promise<string>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.clientSocket!.removeListener('data', onData);
        reject(new TransportError(
          this.type,
          'Timeout waiting for handshake'
        ));
      }, timeout);

      const onData = (data: string) => {
        if (data.startsWith('connected')) {
          clearTimeout(timeoutHandle);
          this.clientSocket!.removeListener('data', onData);

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

      this.clientSocket!.on('data', onData);
    });
  }

  /**
   * Send a message through the transport
   */
  public async sendMessage(message: string): Promise<void> {
    if (!this.clientSocket || this.clientSocket.destroyed) {
      throw new TransportError(
        this.type,
        'TCP connection is not active'
      );
    }

    const data = message + '\uFFFF';

    log('debug', 'Sending TCP message', {
      length: data.length
    });

    return new Promise<void>((resolve, reject) => {
      this.clientSocket!.write(data, 'utf8', (err) => {
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
   * Start listening for incoming messages
   */
  public startReceiving(handler: (message: string) => void): void {
    if (!this.clientSocket) {
      throw new TransportError(
        this.type,
        'No client socket available for receiving'
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
      log('error', 'TCP socket error', { error: err.message });
    };

    this.closeListener = () => {
      log('info', 'TCP socket closed');
    };

    this.clientSocket.on('data', this.dataListener);
    this.clientSocket.on('error', this.errorListener);
    this.clientSocket.on('close', this.closeListener);

    log('debug', 'Started receiving TCP messages');
  }

  /**
   * Stop listening for messages
   */
  public stopReceiving(): void {
    if (this.clientSocket && this.dataListener) {
      this.clientSocket.removeListener('data', this.dataListener);
      this.clientSocket.removeListener('error', this.errorListener!);
      this.clientSocket.removeListener('close', this.closeListener!);

      this.dataListener = null;
      this.errorListener = null;
      this.closeListener = null;
      this.messageHandler = null;

      log('debug', 'Stopped receiving TCP messages');
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

    // Close client socket
    if (this.clientSocket && !this.clientSocket.destroyed) {
      this.clientSocket.destroy();
      this.clientSocket = null;
    }

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          log('debug', 'TCP transport disposed');
          resolve();
        });
      });
      this.server = null;
    }

    // Clear buffer
    this.receiveBuffer = '';
  }
}
