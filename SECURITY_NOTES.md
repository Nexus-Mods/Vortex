# macOS Security Implementation Notes for Vortex

This document details the security measures implemented in Vortex for macOS and the rationale behind them.

## Hardened Runtime Implementation

### Overview
Vortex implements Apple's hardened runtime to provide additional security protections against runtime injection and other attacks.

### Entitlements Rationale

#### Main Entitlements (`build/entitlements.mac.plist`)

1. **`com.apple.security.cs.allow-jit`**
   - **Purpose:** Allows just-in-time compilation
   - **Rationale:** Required for Electron's JavaScript engine to function properly
   - **Risk:** Low - JIT is essential for modern web applications

2. **`com.apple.security.cs.allow-unsigned-executable-memory`**
   - **Purpose:** Allows creation and execution of unsigned executable memory
   - **Rationale:** Required for dynamic code generation in Electron
   - **Risk:** Medium - Could potentially be exploited, but necessary for functionality

3. **`com.apple.security.cs.disable-library-validation`**
   - **Purpose:** Disables library validation
   - **Rationale:** Allows loading of third-party libraries and native modules
   - **Risk:** Medium - Could allow loading of malicious libraries, but required for extensions

4. **`com.apple.security.device.audio-input`**
   - **Purpose:** Access to audio input devices
   - **Rationale:** Required for voice chat features in some games
   - **Risk:** Low - Limited to audio input only

5. **`com.apple.security.device.camera`**
   - **Purpose:** Access to camera devices
   - **Rationale:** Required for camera features in some games
   - **Risk:** Low - Limited to camera access only

6. **`com.apple.security.files.downloads.read-write`**
   - **Purpose:** Read-write access to Downloads folder
   - **Rationale:** Required for downloading mods and game files
   - **Risk:** Low - Limited to Downloads folder

7. **`com.apple.security.files.user-selected.read-write`**
   - **Purpose:** Read-write access to user-selected files
   - **Rationale:** Required for accessing game directories and mod files
   - **Risk:** Low - Only applies to user-granted access

8. **`com.apple.security.network.client`**
   - **Purpose:** Outbound network connections
   - **Rationale:** Required for connecting to Nexus Mods API and downloading content
   - **Risk:** Low - Essential for application functionality

9. **`com.apple.security.network.server`**
   - **Purpose:** Inbound network connections
   - **Rationale:** Required for local web server functionality (e.g., handling nxm:// URLs)
   - **Risk:** Low - Limited to localhost connections

#### Inheritance Entitlements (`build/entitlements.inherit.plist`)

These entitlements are more restrictive and apply to subprocesses:

1. **`com.apple.security.cs.allow-jit`**
   - **Purpose:** Allows just-in-time compilation in subprocesses
   - **Rationale:** Some subprocesses may need JIT compilation

2. **`com.apple.security.cs.allow-unsigned-executable-memory`**
   - **Purpose:** Allows unsigned executable memory in subprocesses
   - **Rationale:** Required for subprocess functionality

3. **`com.apple.security.cs.disable-library-validation`**
   - **Purpose:** Disables library validation in subprocesses
   - **Rationale:** Allows subprocesses to load necessary libraries

4. **`com.apple.security.network.client`**
   - **Purpose:** Outbound network connections for subprocesses
   - **Rationale:** Subprocesses may need to download or upload data

## Code Signing Implementation

### Certificate Requirements
- **Developer ID Application:** Required for code signing the main application
- **Developer ID Installer:** Required for PKG installer distribution (if used)

### Signing Process
1. Sign the main app bundle with hardened runtime options
2. Verify signature with strict checking
3. Timestamp signatures for future validation

### Verification Commands
```bash
# Verify code signing
codesign --verify --deep --strict --verbose=2 /path/to/Vortex.app

# Display signature information
codesign --display --verbose=4 /path/to/Vortex.app
```

## Notarization Implementation

### Process Overview
1. Create ZIP archive of app bundle
2. Submit archive to Apple's notarization service
3. Wait for notarization completion
4. Staple notarization ticket to app bundle

### Notarization Benefits
- Clears quarantine attributes automatically
- Provides Apple's malware scanning
- Enables Gatekeeper acceptance
- Improves user trust

### Verification Commands
```bash
# Verify notarization
spctl --assess --type exec --verbose /path/to/Vortex.app

# Check stapled ticket
xcrun stapler validate /path/to/Vortex.app
```

## Subprocess Launch Security

### PATH Sanitization
Implemented in `src/util/macOSSecurity.ts`:
- Removes potentially dangerous paths like Homebrew directories
- Prevents execution of unexpected tools
- Maintains essential system paths

### Environment Variable Filtering
- Removes potentially dangerous variables:
  - `DYLD_LIBRARY_PATH`
  - `DYLD_FRAMEWORK_PATH`
  - `DYLD_INSERT_LIBRARIES`
  - `LD_LIBRARY_PATH`
  - `LD_PRELOAD`

### Secure Execution Wrapper
The `executeSecureSubprocess` function provides:
- Standardized secure subprocess execution
- Consistent security measures across the application
- Proper error handling and logging

## File System Security

### Security-Scoped Bookmarks
Implemented for persistent file access:
- Allows access to user-granted directories after app restart
- Required for proper TCC compliance
- Cached for performance

### Path Normalization
- Handles case-insensitive file systems
- Resolves relative paths and symlinks
- Prevents path traversal attacks

### Translocation Detection
- Detects when app is running from translocated location
- Provides guidance for proper installation
- Prevents issues with file access permissions

## Network Security

### Secure Network Requests
- Implements certificate pinning for critical services
- Adds request size limits and timeouts
- Validates TLS certificates
- Restricts allowed domains

### Content Security Policy
Enhanced CSP headers protect against:
- Cross-site scripting (XSS) attacks
- Code injection
- Unauthorized resource loading

## Extension Security

### Sandboxing Considerations
While Vortex doesn't implement full extension sandboxing on macOS (due to complexity and functionality requirements), it does:
- Validate extension signatures (future implementation)
- Restrict extension permissions (future implementation)
- Monitor extension behavior (future implementation)

### Permission Model
Future enhancements will include:
- Granular permission controls
- User consent for sensitive operations
- Extension capability restrictions

## Security Testing

### Automated Security Scanning
- Dependency vulnerability scanning with `yarn audit`
- Static code analysis
- Regular security reviews

### Manual Security Testing
- Penetration testing
- Security architecture reviews
- Incident response procedures

## Compliance and Certifications

### Apple Platform Compliance
- Hardened runtime implementation
- Proper entitlements usage
- Code signing and notarization
- TCC compliance

### Data Protection
- Secure storage of sensitive information
- Encryption of user data where appropriate
- Privacy-focused design

## Future Security Enhancements

### Planned Improvements
1. **Enhanced Extension Security:**
   - Full extension sandboxing
   - Signature verification for all extensions
   - Runtime permission controls

2. **Advanced Network Security:**
   - Certificate pinning for all external services
   - Enhanced TLS validation
   - Request/response filtering

3. **Improved File System Security:**
   - Enhanced path validation
   - Additional access controls
   - Audit logging for file operations

4. **Security Monitoring:**
   - Real-time threat detection
   - Automated incident response
   - Security event correlation

## Risk Assessment

### Current Security Posture
- **Overall Risk:** Low
- **Attack Surface:** Limited
- **Mitigation Effectiveness:** High

### Known Risks
1. **Extension Loading:**
   - **Risk:** Medium - Extensions have broad system access
   - **Mitigation:** Future sandboxing implementation

2. **Network Access:**
   - **Risk:** Low - Limited to necessary services
   - **Mitigation:** Certificate pinning and request validation

3. **File System Access:**
   - **Risk:** Low - User-granted access only
   - **Mitigation:** Security-scoped bookmarks and TCC compliance

## Incident Response

### Security Event Handling
- Automated security event logging
- Critical event alerting
- Incident response procedures

### Vulnerability Management
- Regular security audits
- Dependency update procedures
- Patch management processes

## Conclusion

Vortex's macOS security implementation provides a strong foundation for protecting users while maintaining functionality. The combination of hardened runtime, code signing, notarization, and secure subprocess execution creates multiple layers of protection against common security threats.

The implementation balances security with usability, ensuring that users can fully utilize Vortex's features while maintaining a high level of protection against potential threats.

Regular security reviews and updates will continue to enhance the security posture as new threats emerge and security technologies evolve.