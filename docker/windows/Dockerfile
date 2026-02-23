# escape=`
# Vortex CI Windows Build Image
# Based on .NET 9.0 SKD on Windows Server 2022 LTSC
# Uses node-gyp recommended setup: https://github.com/nodejs/node-gyp#on-windows

ARG BASE_IMAGE=dotnet/sdk
ARG DOTNET_VERSION=9.0
ARG WIN_VER=ltsc2025
FROM mcr.microsoft.com/${BASE_IMAGE}:${DOTNET_VERSION}-windowsservercore-${WIN_VER}

# Install Chocolatey
SHELL ["powershell", "-Command"]
RUN [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; `
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')); `
    Import-Module $env:ChocolateyInstall\helpers\chocolateyProfile.psm1

# Update Windows root certificates from Windows Update
# This fixes SSL certificate validation issues when downloading from npm registry
RUN certutil -generateSSTFromWU C:\roots.sst; `
    if (Test-Path C:\roots.sst) { `
        certutil -addstore Root C:\roots.sst; `
        Remove-Item C:\roots.sst; `
    }

# Install development tools
# python: Python 3 for node-gyp
# git.install: Git with Unix tools on PATH
# volta: Node.js version manager (reads versions from package.json)
# cmake: Required for building native dependencies like gamebryo-savegame
RUN choco install -y python310 --no-progress; `
    choco install -y git.install --params "'/GitAndUnixToolsOnPath /NoGitLfs /NoCredentialManager /NoGuiHereIntegration'" --no-progress; `
    choco install -y volta --no-progress; `
    choco install -y cmake --installargs 'ADD_CMAKE_TO_PATH=System' --no-progress

# Install VS Build Tools with C++ workload including ATL/MFC
# Using .vsconfig file to avoid command-line parsing issues
RUN Write-Host '=== Creating VS configuration file ==='; `
    [System.IO.File]::WriteAllText('C:\.vsconfig', '{\"version\":\"1.0\",\"components\":[\"Microsoft.VisualStudio.Workload.VCTools\",\"Microsoft.VisualStudio.Component.VC.Tools.x86.x64\",\"Microsoft.VisualStudio.Component.VC.ATL\",\"Microsoft.VisualStudio.Component.VC.ATLMFC\",\"Microsoft.VisualStudio.Component.Windows11SDK.22621\"]}'); `
    Write-Host '=== Downloading VS Build Tools installer ==='; `
    Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_buildtools.exe' -OutFile C:\vs_buildtools.exe; `
    Write-Host '=== Installing Visual Studio Build Tools ==='; `
    Start-Process -Wait -FilePath C:\vs_buildtools.exe -ArgumentList '--quiet', '--wait', '--norestart', '--nocache', '--config', 'C:\.vsconfig'; `
    Write-Host '=== Verifying installation ==='; `
    $msvcDir = Get-ChildItem -Path 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1; `
    if ($msvcDir) { `
        Write-Host "MSVC installed at: $($msvcDir.FullName)"; `
        Get-ChildItem -Path $msvcDir.FullName -Directory | ForEach-Object { Write-Host "  $($_.Name)" }; `
        $atlmfcDir = Join-Path $msvcDir.FullName 'atlmfc'; `
        if (Test-Path $atlmfcDir) { `
            Write-Host "SUCCESS: ATL/MFC directory found at $atlmfcDir"; `
        } else { `
            Write-Host 'WARNING: ATL/MFC directory not found - winapi-bindings may fail to compile'; `
        }; `
    } else { `
        Write-Host 'ERROR: MSVC installation not found'; `
        exit 1; `
    }; `
    Write-Host '=== Cleaning up installer ==='; `
    Remove-Item C:\vs_buildtools.exe -Force -ErrorAction SilentlyContinue; `
    Remove-Item C:\.vsconfig -Force -ErrorAction SilentlyContinue; `
    Write-Host 'Terminating lingering installer processes...'; `
    Get-Process | Where-Object {$_.Name -match 'vs_|vctip|vsix|ServiceHub|PerfWatson'} | Stop-Process -Force -ErrorAction SilentlyContinue; `
    Start-Sleep -Seconds 2; `
    Write-Host 'Installation complete' 

# Default working directory
WORKDIR C:\src

# Entry point - Initialize VS Developer environment (x64) and launch PowerShell
# VsDevCmd.bat sets up PATH, LIB, INCLUDE for the MSVC toolchain (cl.exe, link.exe, etc.)
# -arch=amd64 ensures 64-bit tools are used for NativeAOT compilation
ENTRYPOINT ["C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat", "-arch=amd64", "&&", "powershell.exe", "-NoLogo", "-ExecutionPolicy", "Bypass"]