# Debian-based Setup

Install distro packages here first, then continue with [Shared Setup].

Validated on 13 April 2026. Verified on Ubuntu 24.04 and Pop!\_OS 24.04.
If any step is out of date, please open a [PR] or [issue].

## System Packages

### Refresh Package Metadata

Refresh package lists so install uses latest repo data.

```bash
sudo apt update
```

### Install Dependencies

```bash
sudo apt install build-essential git python3 python3-setuptools curl wget libfontconfig-dev
```

## .NET 9 SDK

### Debian

Based on official [.NET 9 install docs for Debian].

```bash
# Add Microsoft package feed
source /etc/os-release
wget \
  "https://packages.microsoft.com/config/debian/${VERSION_ID}/packages-microsoft-prod.deb" \
  -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb

# Refresh package lists
sudo apt update

# Install .NET 9 SDK
sudo apt install dotnet-sdk-9.0
```

### Ubuntu-based Distros

Based on official [.NET 9 install docs for Ubuntu].

Try this first:

```bash
sudo apt install dotnet-sdk-9.0
```

If `apt` cannot find the package, add Ubuntu .NET backports and retry.

```bash
# Install helper for add-apt-repository
sudo apt install software-properties-common

# Add Ubuntu .NET backports
sudo add-apt-repository ppa:dotnet/backports

# Refresh package lists
sudo apt update

# Install .NET 9 SDK
sudo apt install dotnet-sdk-9.0
```

## Verify Install

```bash
python3 --version
gcc --version
dotnet --list-sdks
```

## Continue Setup

After the packages above are installed, continue with [Shared Setup].

## Extra Resources

- [Debian package tracker]
- [.NET 9 install docs for Debian]
- [Ubuntu .NET backports package repository]

[Shared Setup]: ./shared.md
[Debian package tracker]: https://tracker.debian.org/
[.NET 9 install docs for Debian]: https://learn.microsoft.com/en-gb/dotnet/core/install/linux-debian?tabs=dotnet9
[.NET 9 install docs for Ubuntu]: https://learn.microsoft.com/en-gb/dotnet/core/install/linux-ubuntu-install?tabs=dotnet9
[PR]: https://github.com/Nexus-Mods/Vortex/compare
[issue]: https://github.com/Nexus-Mods/Vortex/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=
[Ubuntu .NET backports package repository]: https://launchpad.net/~dotnet/+archive/ubuntu/backports
