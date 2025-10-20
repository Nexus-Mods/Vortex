# Releasing Vortex for macOS

This document describes the process for creating and publishing official Vortex releases for macOS.

## Release Preparation

### Versioning
1. Update the version in `package.json` in the root directory
2. Update the version in `app/package.json` 
3. Ensure versions match between both files
4. Commit version changes with a message like "Bump version to X.Y.Z"

### Release Notes
1. Update `CHANGELOG.md` with changes for the new version
2. Ensure all significant changes are documented
3. Include any breaking changes or migration notes

### Pre-release Testing
Before creating an official release, perform these tests:

1. Clean build and test:
   ```bash
   yarn clean
   yarn install
   yarn test
   ```

2. Build macOS distribution:
   ```bash
   yarn run build:macos
   ```

3. Test the built application:
   - Launch the app from the DMG
   - Verify basic functionality
   - Test game discovery
   - Test mod installation

## Creating a Release

### Build with Code Signing and Notarization
Create a production build with code signing and notarization:

```bash
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# Build with notarization
yarn run build:macos --notarize
```

This process will:
1. Build the application with webpack
2. Package the application with electron-builder
3. Sign the application with hardened runtime
4. Notarize the application with Apple
5. Staple the notarization ticket

### Verify the Build
After building, verify the signatures and notarization:

```bash
# Verify code signing
codesign --verify --deep --strict --verbose=2 dist/mac/Vortex.app

# Verify notarization
spctl --assess --type exec --verbose dist/mac/Vortex.app
```

### Create Release Artifacts
The build process creates the following artifacts:
- `dist/mac/Vortex-VERSION.dmg` - DMG installer
- `dist/mac/Vortex-VERSION-mac.zip` - ZIP archive
- `dist/mac/Vortex-VERSION-arm64.dmg` - ARM64 DMG (Apple Silicon)
- `dist/mac/Vortex-VERSION-arm64-mac.zip` - ARM64 ZIP archive

## Publishing the Release

### GitHub Releases
1. Create a new release on GitHub
2. Use the version number as the tag (e.g., v1.8.0)
3. Use the version number as the release title
4. Copy release notes from CHANGELOG.md
5. Upload all distribution files:
   - DMG files
   - ZIP files
   - SHA256 checksums

### Update Servers
Update the appropriate update servers with the new version information.

### Announcement
Announce the release:
- Nexus Mods forums
- Social media channels
- Discord server

## Rollback Procedures

### Identifying Issues
Monitor for issues after release:
- Crash reports
- User feedback
- Support tickets
- Update server metrics

### Rollback Process
If a critical issue is discovered:

1. Pull the release from update servers
2. Create a hotfix branch from the previous stable version
3. Fix the critical issue
4. Create a new release with a patch version bump
5. Publish the hotfix release
6. Announce the issue and resolution

### Hotfix Release
For critical issues requiring immediate fixes:

1. Create a hotfix branch:
   ```bash
   git checkout -b hotfix/vX.Y.Z
   ```

2. Make necessary fixes
3. Update version numbers
4. Build and test
5. Create release as normal

## Security Considerations

### Code Signing Certificates
- Ensure certificates are valid and not expired
- Keep certificates secure
- Renew certificates before expiration

### Notarization
- Monitor notarization status
- Handle notarization failures
- Keep Apple ID credentials secure

### Vulnerability Scanning
Before each release:
```bash
yarn audit
```

Address any high or critical vulnerabilities before release.

## Automated Release Process

### CI/CD Pipeline
The release process can be automated using GitHub Actions:

1. Trigger on version tag push
2. Build for all platforms
3. Code sign and notarize macOS builds
4. Create GitHub release
5. Upload artifacts
6. Update update servers

### Environment Secrets
Store the following as GitHub secrets:
- `APPLE_ID`
- `APPLE_ID_PASSWORD`
- `APPLE_TEAM_ID`
- Code signing certificates

## Post-Release Activities

### Monitoring
Monitor:
- Application crash rates
- User feedback
- Support ticket volume
- Update adoption rates

### Metrics Collection
Collect and analyze:
- Active user counts
- Feature usage statistics
- Performance metrics
- Error rates

### Feedback Loop
- Review user feedback
- Identify common issues
- Plan improvements for next release
- Update documentation as needed

## Troubleshooting

### Common Release Issues

#### "Notarization Failed"
- Check Apple ID credentials
- Verify certificates are valid
- Ensure proper entitlements
- Check network connectivity

#### "Code Signing Failed"
- Verify certificates are installed
- Check certificate expiration dates
- Ensure proper Keychain access

#### "Build Failed"
- Check for TypeScript errors
- Verify all dependencies are installed
- Ensure correct Node.js version

### Emergency Procedures

#### Immediate Release Blocking Issue
1. Halt release process
2. Notify team
3. Identify root cause
4. Determine workaround or fix
5. Decide on rollback or hotfix

#### Security Incident
1. Immediately pull affected releases
2. Notify security team
3. Assess impact
4. Implement fixes
5. Create security advisory
6. Communicate with users

## Release Checklist

### Pre-Build
- [ ] Version updated in package.json
- [ ] Version updated in app/package.json
- [ ] CHANGELOG.md updated
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Dependencies up to date

### Build Process
- [ ] Clean build environment
- [ ] Correct Node.js version
- [ ] Valid Apple certificates
- [ ] Environment variables set
- [ ] Build completes successfully

### Post-Build Verification
- [ ] Code signing verified
- [ ] Notarization verified
- [ ] Application launches correctly
- [ ] Basic functionality tested
- [ ] Game discovery works
- [ ] Mod installation works

### Release Publication
- [ ] GitHub release created
- [ ] All artifacts uploaded
- [ ] Release notes published
- [ ] Update servers updated
- [ ] Announcement prepared

### Post-Release
- [ ] Monitor crash reports
- [ ] Monitor user feedback
- [ ] Update documentation if needed
- [ ] Plan next release

## Additional Resources

- [Apple Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Electron Builder Publishing](https://www.electron.build/configuration/publish)
- [Vortex BUILD_MAC.md](./BUILD_MAC.md)
- [Vortex CHANGELOG.md](./CHANGELOG.md)