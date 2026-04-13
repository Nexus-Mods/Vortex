# Fedora Setup

Install the distro packages here first, then continue with [Shared Setup].

Validated on 13 April 2026 (Fedora 43). If any step is out of date, please open
a [PR] or [issue].

## Refresh Package Metadata

Refresh package lists so install uses latest repo data.

```bash
sudo dnf makecache --refresh
```

## Install Dependencies

```bash
# Install dependencies.
sudo dnf group install development-tools
sudo dnf install git python3 python3-setuptools dotnet-sdk-9.0 gcc g++ fontconfig-devel
```

## Verify Install

```bash
python3 --version
gcc --version
dotnet --list-sdks
```

## Continue Setup

After the packages above are installed, continue with [Shared Setup].

## Extra Related Resources

- [Fedora package search]
- [.NET 9 install docs for Fedora]

[Fedora package search]: https://packages.fedoraproject.org/
[Shared Setup]: ./shared.md
[.NET 9 install docs for Fedora]: https://learn.microsoft.com/en-gb/dotnet/core/install/linux-fedora?tabs=dotnet9
[PR]: https://github.com/Nexus-Mods/Vortex/compare
[issue]: https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=
