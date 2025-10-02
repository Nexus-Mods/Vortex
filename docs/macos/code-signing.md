# macOS Code Signing and Notarization for Vortex

## Overview

This document describes the implementation of automated code signing and notarization for macOS builds of Vortex. This ensures that the application is properly signed and notarized by Apple, which is required for Gatekeeper acceptance and seamless installation on macOS.

## Prerequisites

### 1. Apple Developer Account
- You need an Apple Developer account with permission to create Developer ID certificates
- Membership in the Apple Developer Program (€99/year)

### 2. Developer ID Certificate
- Developer ID Application certificate installed in your Keychain
- Developer ID Installer certificate (for installer packages, if needed)

### 3. App-Specific Password
- Generate an app-specific password for your Apple ID at https://appleid.apple.com/account/manage
- This is required for notarization

### 4. Team ID
- Your Apple Developer Team ID, found at https://developer.apple.com/account/#/membership

## Environment Setup

### 1. Create Environment File
Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` and add your Apple credentials:

```env
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=your-app-specific-password
APPLE_TEAM_ID=your-team-id
```

### 2. Install Developer ID Certificate
Ensure your Developer ID Application certificate is installed in your Keychain:
1. Download the certificate from Apple Developer portal
2. Double-click to install in Keychain Access
3. Verify it appears in the "My Certificates" category

## Build Process

### 1. Standard macOS Packaging Build (without notarization)
```bash
yarn build:macos
```

### 2. macOS Notarization (after packaging)
```bash
yarn notarize:macos
```

## How It Works

### 1. Code Signing
The build process automatically signs the application bundle with your Developer ID Application certificate:
- Uses `codesign` command with deep signing
- Enables hardened runtime for security
- Timestamps the signature for future validation

### 2. Notarization
For notarized builds:
1. Creates a zip archive of the signed app bundle
2. Submits the archive to Apple's notarization service
3. Waits for the notarization process to complete
4. Staples the notarization ticket to the app bundle
5. Verifies the notarization was successful

### 3. Verification
The process includes multiple verification steps:
- Code signature verification with strict checking
- Notarization verification with Gatekeeper assessment

## Scripts

### notarize-macos.js
Handles the complete code signing and notarization workflow:
- Signs the app bundle with Developer ID certificate
- Verifies the code signature
- Creates zip archive for notarization
- Submits to Apple notary service
- Staples notarization ticket
- Verifies notarization

### build-macos.js
Orchestrates the complete build process:
- Builds the application with webpack
- Packages with electron-builder
- Optionally runs notarization

## CI/CD Integration

For automated builds in CI/CD environments:
1. Store Apple credentials as secure environment variables
2. Install certificates in the build environment
3. Run `yarn build:macos && yarn notarize:macos`

Example GitHub Actions workflow snippet:
```yaml
- name: Set up macOS signing
  run: |
    echo "${{ secrets.MACOS_CERTIFICATE }}" | base64 --decode > certificate.p12
    security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
    security import certificate.p12 -k build.keychain -P "$CERTIFICATE_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain

- name: Build and notarize
  run: |
    yarn build:macos
    yarn notarize:macos
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

## Troubleshooting

### Common Issues

1. **Certificate not found**
   - Ensure Developer ID certificate is installed in Keychain
   - Verify certificate name matches "Developer ID Application"

2. **Notarization fails**
   - Check Apple ID credentials
   - Verify app-specific password is correct
   - Ensure Team ID is correct

3. **Stapling fails**
   - Make sure notarization completed successfully
   - Check internet connectivity

### Verification Commands

Check code signature:
```bash
codesign --verify --deep --strict --verbose=2 dist/mac/Vortex.app
```

Check notarization:
```bash
spctl --assess --type exec --verbose dist/mac/Vortex.app
```

View signature details:
```bash
codesign --display --verbose=4 dist/mac/Vortex.app
```

## Security Considerations

1. **Protect Credentials**
   - Never commit `.env` file to version control
   - Use secure storage for CI/CD credentials
   - Rotate app-specific passwords regularly

2. **Certificate Management**
   - Keep private keys secure
   - Revoke compromised certificates immediately
   - Use separate certificates for development and production

## Future Enhancements

Potential improvements could include:
- Automated certificate management
- Integration with Apple's API for certificate provisioning
- Support for multiple signing identities
- Enhanced error reporting and logging
- Integration with keychain management tools