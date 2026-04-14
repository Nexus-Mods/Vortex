# Arch Linux Setup

Install the distro packages here first, then continue with [Shared Setup].

Validated on 13 April 2026 (`CachyOS 26.03`). If any deps are missing please open
a [PR] or [issue].

## Refresh Package Databases

Refresh package lists so install uses latest repo data.

```bash
sudo pacman -Sy
```

## Install Dependencies

```bash
sudo pacman -S --needed base-devel git python python-setuptools dotnet-sdk-9.0
```

## Verify Install

```bash
python --version
gcc --version
dotnet --list-sdks
```

## Continue Setup

After the packages above are installed, continue with [Shared Setup].

## Extra Resources

- [Arch package search]
- [Arch package: dotnet-sdk-9.0]
- [Generic .NET on Linux docs]

[Arch package search]: https://archlinux.org/packages/
[Arch package: dotnet-sdk-9.0]: https://archlinux.org/packages/extra/x86_64/dotnet-sdk-9.0/
[Generic .NET on Linux docs]: https://learn.microsoft.com/en-gb/dotnet/core/install/linux?tabs=dotnet9
[Shared Setup]: ./shared.md
[PR]: https://github.com/Nexus-Mods/Vortex/compare
[issue]: https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=
[.NET on Linux documentation]: https://learn.microsoft.com/en-gb/dotnet/core/install/linux?tabs=dotnet9
