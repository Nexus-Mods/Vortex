# Windows Packaging

Use this page when you need a Windows installer for local testing or you need
to understand how signed release builds are produced.

## Local Unsigned Packages

To create a packaged installer for local testing without code signing:

```bash
pnpm run package:local
```

This prepares the Windows runtime assets, downloads the required
redistributables, and creates an unsigned installer in `dist/`.

The packaging workflow downloads:

- The Microsoft Visual C++ Redistributable,
- The .NET Desktop Runtime used by the packaged app.

## Signed Release Builds

Signed builds are created automatically through CI. Do not run `pnpm run package` locally unless you are working in the release automation context with the required signing secrets.

The release workflow is defined in [package.yml] and runs on `windows-latest`.

## Output

Successful packaging produces files in `dist/`, including:

- `vortex-setup-<version>.exe`
- `latest.yml`

CI can also upload unpacked and installer artifacts for release workflows.

## References

- [electron-builder documentation]
- [electron-builder NSIS configuration]
- [Package workflow]

[Package workflow]: ../../.github/workflows/package.yml
[electron-builder documentation]: https://www.electron.build/
[electron-builder NSIS configuration]: https://www.electron.build/configuration/nsis
[package.yml]: ../../.github/workflows/package.yml
