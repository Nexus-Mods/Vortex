/**
 * Transport module for FOMOD IPC communication
 * Provides pluggable transport mechanisms (Named Pipes, TCP, Unix Sockets)
 * with automatic fallback and platform-specific optimizations
 */

export { ITransport, TransportType, TransportError } from './ITransport';
export { TCPTransport } from './TCPTransport';
export { NamedPipeTransport } from './NamedPipeTransport';
