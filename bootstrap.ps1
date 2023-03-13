$windows_sdk_ver = 20348
$build_directory = "c:\build"

Invoke-WebRequest -useb get.scoop.sh | Invoke-Expression

scoop bucket add versions
scoop install python310 nodejs-lts cmake git yarn

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

New-Item -ItemType Directory -Force -Path $build_directory
Set-Location $build_directory

& git clone https://github.com/Nexus-Mods/Vortex.git vortex

& yarn config set msvs_version $msvs_ver --global
Set-Location vortex
& yarn install
& yarn run build
