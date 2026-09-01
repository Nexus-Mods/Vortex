# Windows Setup

Open PowerShell or Command Prompt first. Install Windows prerequisites here,
then continue with [Shared Setup].

Validated on 29 August 2026 (Windows 11 25H2). If any step is out of date, please
open a [PR] or [issue].

## Install Dependencies

### Visual Studio 2022 Build Tools

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e
```

Open Visual Studio Installer and select:

### Workload

- Desktop development with C++

### Individual Components

- MSVC v143 - VS 2022 C++ x64/x86 build tools (Latest)
- C++ ATL for latest v143 build tools (x86 & x64)
- C++ MFC for latest v143 build tools (x86 & x64)
- Windows 11 SDK (10.0.22621.0)

The default workload is not enough by itself. Vortex uses native Node modules,
so `node-gyp` needs ATL, MFC, and Windows 11 SDK.

### Git

```powershell
winget install --id Git.Git -e
```

### Python 3.14

```powershell
winget install --id Python.Python.3.14 -e
```

Python 3.12+ needs `setuptools`:

```powershell
python -m pip install --upgrade setuptools
```

Close and reopen PowerShell or Command Prompt after install so `python` resolves
from `PATH`.

### CMake

```powershell
winget install --id Kitware.CMake -e
```

Some native build pieces need CMake during local builds.

### .NET 9 SDK

```powershell
winget install --id Microsoft.DotNet.SDK.9 -e
```

### Node.js (Optional)

Vortex does not need this. `pnpm` downloads the pinned `node.js` version during
[Shared Setup], and that version is used regardless of what is on your `PATH`.
Install it only if you want `node` and `npm` available for other projects:

```powershell
winget install -e --id OpenJS.NodeJS.LTS
```

## Verify Install

Restart computer so `git`, `python` and `cmake` resolves from `PATH`.

To verify `PATH` after restart

```powershell
$env:path -split ';'
```

To verify installed dependencies

```powershell
git --version
python --version
cmake --version
dotnet --list-sdks
```

## Continue Setup

After the prerequisites above are installed, continue with [Shared Setup].

## Notes

- Use VS 2022 Build Tools for this repo, not newer MSVC toolsets.
- Use `C:\v` due to path length limits in Windows and Git.

## Extra Resources

- [Git for Windows]
- [Visual Studio 2022 Build Tools]
- [.NET 9 install docs for Windows]
- [winget]
- [Windows CI build image]

[Shared Setup]: ./shared.md
[PR]: https://github.com/Nexus-Mods/Vortex/compare
[issue]: https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=
[Git for Windows]: https://git-scm.com/downloads/win
[Visual Studio 2022 Build Tools]: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
[.NET 9 install docs for Windows]: https://learn.microsoft.com/en-gb/dotnet/core/install/windows?tabs=net9
[winget]: https://learn.microsoft.com/windows/package-manager/winget/
[Windows CI build image]: ../../docker/windows/Dockerfile
