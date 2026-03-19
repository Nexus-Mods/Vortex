/**
 * Shared protocol-registration options passed from ExtensionManager
 * into the protocol-registration routing layer.
 *
 * This covers extension/plugin/tool URI handlers and allows platform-specific
 * routes (for example, Linux `nxm`) to use additional launch context.
 */
export interface IProtocolRegistrationOptions {
  /** URI scheme name without trailing `:` (for example `nxm`, `http`). */
  protocol: string;
  /** Whether Vortex should be set as the default system handler. */
  setAsDefault: boolean;
  /**
   * Path to Vortex's user data directory.
   *
   * This is where Vortex stores its settings, downloaded mods, and other files.
   * When you click a protocol link (like nxm://), the operating system needs to
   * know which Vortex instance should handle it - especially if you have multiple
   * Vortex installations. This path helps identify the correct instance.
   */
  userDataPath?: string;
}
