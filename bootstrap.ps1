$windows_sdk_ver = 20348
$build_directory = "c:\build"
$scoop_installer = "install_scoop.ps1";

Write-Host "Downloading Scoop install script..."

Invoke-WebRequest -useb get.scoop.sh -outfile $scoop_installer

if (!(Test-Path -Path $scoop_installer)) { 
    $fullpath = Join-Path $PWD $scoop_installer
    Write-Host "Download failed. $fullpath does not exist."
    exit 1
}

Write-Host "Running Scoop install script..."
& ".\$scoop_installer" -RunAsAdmin

try {
  scoop help
} catch {
  Write-Host "A Scoop error occured. Probably hasn't installed correctly. $($_.Exception.Message)"
  exit 1
}

Write-Host "Installing essential apps via Scoop"

scoop install git
scoop bucket add versions
scoop install python310 nodejs18 cmake yarn

Write-Host "Downloading Visual Studio Build Tools..."

Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile "$env:TEMP\vs_BuildTools.exe"

# no scoop installer for vs build tools because there are too many options
Start-Process -FilePath "$env:TEMP\vs_BuildTools.exe" -ArgumentList `
  "--passive", "--wait",
  "--add Microsoft.VisualStudio.Workload.VCTools",
  "--includeRecommended",
  "--add Microsoft.NetCore.Component.Runtime.6.0",
  "--add Microsoft.NetCore.Component.SDK",
  "--add Microsoft.VisualStudio.Component.VC.ATL",
  "--add Microsoft.VisualStudio.Component.Windows10SDK.$windows_sdk_ver",
  "--remove Microsoft.VisualStudio.Component.VC.CMake.Project" `
  -Wait `
  -PassThru


Write-Host "Cloning and Building Vortex from GitHub..."

New-Item -ItemType Directory -Force -Path $build_directory
Set-Location $build_directory

& git clone https://github.com/Nexus-Mods/Vortex.git vortex

& yarn config set msvs_version $msvs_ver --global
Set-Location vortex
& yarn install
& yarn run build

Write-Host "Environment setup complete."