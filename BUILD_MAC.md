# Building Vortex for macOS

This document provides instructions for building, signing, and distributing Vortex for macOS platforms.

## Prerequisites

### System Requirements
- macOS 10.15 (Catalina) or later
- Xcode 12.2 or later with command line tools
- Node.js 18.x or later
- Yarn 1.x
- Apple Developer ID certificates

### Development Environment Setup

1. Install Xcode from the Mac App Store
2. Install Xcode command line tools:
   ```bash
   xcode-select --install
   ```

3. Install Node.js (preferably using nvm):
   ```bash
   # Install nvm if not already installed
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   
   # Install and use the required Node.js version
   nvm install 18
   nvm use 18
   ```

4. Install Yarn:
   ```bash
   npm install -g yarn
   ```

5. Clone the Vortex repository:
   ```bash
   git clone https://github.com/Nexus-Mods/Vortex.git
   cd Vortex
   ```

6. Install dependencies:
   ```bash
   yarn install
   ```

## Building Vortex

### Development Build
To build Vortex for development and testing:

```bash
yarn build
yarn start
```

### Production Build
To create a production build for macOS:

```bash
yarn run build:macos
```

This will:
1. Build the application with webpack
2. Package the application with electron-builder
3. Create both DMG and ZIP distributions

### Build with Code Signing and Notarization
To create a production build with code signing and notarization:

```bash
yarn run build:macos --notarize
```

This requires Apple Developer credentials to be configured in environment variables.

## Code Signing

### Prerequisites
- Apple Developer ID Application certificate
- Apple Developer ID Installer certificate (for PKG distribution)
- Apple ID credentials with app-specific password

### Certificate Setup
1. Enroll in the Apple Developer Program
2. Generate certificates in the Apple Developer portal
3. Download and install the certificates in Keychain Access

### Environment Variables
Set the following environment variables for code signing and notarization:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="your-team-id"
```

Alternatively, create a `.env` file in the project root:

```env
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=your-app-specific-password
APPLE_TEAM_ID=your-team-id
```

## Notarization

The build process automatically handles notarization when the `--notarize` flag is used. This process:

1. Signs the app bundle with hardened runtime
2. Creates a ZIP archive for notarization
3. Submits the archive to Apple's notarization service
4. Waits for notarization to complete
5. Staples the notarization ticket to the app bundle

## Entitlements

Vortex uses two entitlements files for macOS:

### Main Entitlements (`build/entitlements.mac.plist`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
    <key>com.apple.security.files.downloads.read-write</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
  </dict>
</plist>
```

### Inheritance Entitlements (`build/entitlements.inherit.plist`)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
  </dict>
</plist>
```

## Testing

### Local Testing
Before distributing, test the build locally:

```bash
# Test the built application
open dist/mac/Vortex.app

# Verify code signing
codesign --verify --deep --strict --verbose=2 dist/mac/Vortex.app

# Verify notarization (if applicable)
spctl --assess --type exec --verbose dist/mac/Vortex.app
```

### Automated Testing
Run the test suite:

```bash
yarn test
```

## Distribution

### DMG Distribution
The build process creates a DMG file that can be distributed directly:

```
dist/mac/Vortex-VERSION.dmg
```

### ZIP Distribution
A ZIP archive is also created for direct downloads:

```
dist/mac/Vortex-VERSION-mac.zip
```

## Troubleshooting

### Common Build Issues

#### "Command failed: yarn install"
Ensure you're using the correct Node.js version:
```bash
nvm use 18
```

#### "No valid code signing certificates found"
Make sure your Apple Developer certificates are installed in Keychain Access.

#### "Notarization failed"
Check your Apple ID credentials and ensure your app-specific password is correct.

### Code Signing Verification
To verify code signing was successful:
```bash
codesign --verify --deep --strict dist/mac/Vortex.app
```

### Notarization Verification
To verify notarization was successful:
```bash
spctl --assess --type exec dist/mac/Vortex.app
```

## Security Considerations

### Hardened Runtime
Vortex is built with hardened runtime enabled, which provides additional security protections.

### Entitlements
The entitlements files specify the exact permissions Vortex needs to function properly.

### Secure Subprocess Execution
Vortex implements secure subprocess execution with:
- PATH sanitization
- Environment variable filtering
- Proper app bundle execution

## Performance Optimization

### Build Optimization
For faster builds during development:
```bash
yarn buildwatch
```

### Native Module Compilation
Native modules are compiled for macOS during the postinstall process.

## Versioning

Vortex uses semantic versioning. Update the version in `package.json` before building a release.

## Release Process

1. Update version in `package.json`
2. Commit version changes
3. Create and push a git tag
4. Build with code signing and notarization
5. Upload distributions to release server

## Additional Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Electron Builder Documentation](https://www.electron.build/)
- [Vortex Development Guide](./DEVELOPMENT.md)