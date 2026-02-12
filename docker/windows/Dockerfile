# escape=`
# Vortex CI Windows Build Image
# Based on .NET 9.0 SKD on Windows Server 2022 LTSC
# Uses node-gyp recommended setup: https://github.com/nodejs/node-gyp#on-windows

ARG BASE_IMAGE=dotnet/sdk
ARG DOTNET_VERSION=9.0
ARG WIN_VER=ltsc2022
FROM mcr.microsoft.com/${BASE_IMAGE}:${DOTNET_VERSION}-windowsservercore-${WIN_VER}

# Install Chocolatey
SHELL ["powershell", "-Command"]
RUN [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; `
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')); `
    Import-Module $env:ChocolateyInstall\helpers\chocolateyProfile.psm1

# Install all build tools using node-gyp recommended approach
# visualstudio2022-workload-vctools: Installs VS Build Tools with C++ workload
# python: Python 3 for node-gyp
# git.install: Git with Unix tools on PATH
# volta: Node.js version manager (reads versions from package.json)
# Note: vswhere may return empty, but node-gyp uses VCINSTALLDIR (set by VsDevCmd.bat) as primary detection
RUN choco install -y python310 --no-progress; `
    choco install -y visualstudio2022-workload-vctools --no-progress; `
    choco install -y git.install --params "'/GitAndUnixToolsOnPath /NoGitLfs /NoCredentialManager /NoGuiHereIntegration'" --no-progress; `
    choco install -y volta --no-progress

# Add ATL component required for winapi-bindings (atlbase.h)
# Must use VS installer directly since Chocolatey won't modify existing installation
RUN & 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe' modify `
    --installPath 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools' `
    --add Microsoft.VisualStudio.Component.VC.ATL `
    --quiet --norestart --wait; `
    Remove-Item -Recurse -Force 'C:\ProgramData\Package Cache\*' -ErrorAction SilentlyContinue; `
    Remove-Item -Recurse -Force 'C:\Users\ContainerAdministrator\AppData\Local\Temp\*' -ErrorAction SilentlyContinue; `
    Remove-Item -Recurse -Force 'C:\Windows\Temp\*' -ErrorAction SilentlyContinue; `
    Remove-Item -Recurse -Force 'C:\ProgramData\chocolatey\logs\*' -ErrorAction SilentlyContinue; `
    Remove-Item -Recurse -Force 'C:\ProgramData\chocolatey\.chocolatey\*' -ErrorAction SilentlyContinue

# Default working directory
WORKDIR C:\src

# Entry point - Initialize VS Developer environment (x64) and launch PowerShell
# VsDevCmd.bat sets up PATH, LIB, INCLUDE for the MSVC toolchain (cl.exe, link.exe, etc.)
# -arch=amd64 ensures 64-bit tools are used for NativeAOT compilation
ENTRYPOINT ["C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat", "-arch=amd64", "&&", "powershell.exe", "-NoLogo", "-ExecutionPolicy", "Bypass"]
