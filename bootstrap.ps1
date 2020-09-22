#
# Configuration
#

$python_ver = "2.7.17"
$node_ver = "10.11.0"
$git_ver = "2.24.0"

trap [Exception] {
  write-host "We have an error!"
  if ($_.Exception.InnerException) {
    write-error $("ERROR: " + $_.Exception.InnerException.Message)
  } else {
    write-error $("ERROR: " + $_.Exception.Message)
  }
  Start-Sleep 30
  break
}

[System.Reflection.Assembly]::LoadWithPartialName("System.windows.forms")

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.rootfolder = "MyComputer"

if($dialog.ShowDialog() -ne "OK") {
  exit
}

$path = $dialog.SelectedPath
Set-Location $path

#
# Download and install dependencies
#

Write-Output "Downloading dependencies. There is no feedback during downloads!"

[Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]::Tls12

$wc = New-Object System.Net.WebClient

New-Item -ItemType Directory -Force -Path downloads

$python_exe = "python-$python_ver.amd64.msi"
$node_exe = "node-v$node_ver-x64.msi"
$git_exe = "Git-$git_ver.2-64-bit.exe"

Write-Output "Downloading Node.js $node_ver"
if(![System.IO.File]::Exists($path + "/downloads/$node_exe")) {
  #https://nodejs.org/download/release/v10.11.0/node-v10.11.0-x64.msi
  $wc.DownloadFile("https://nodejs.org/download/release/v$node_ver/$node_exe", $path + "/downloads/$node_exe")
  & "downloads/$node_exe"
}

Write-Output "Downloading Python $python_ver"
if(![System.IO.File]::Exists($path+"/downloads/$python_exe")) {
  #https://www.python.org/ftp/python/2.7.17/python-2.7.17.amd64.msi
  $wc.DownloadFile("https://www.python.org/ftp/python/$python_ver/$python_exe", $path + "/downloads/$python_exe")
  & "downloads/$python_exe"
}

Write-Output "Downloading Git $git_ver"
if(![System.IO.File]::Exists($path + "/downloads/$git_exe")) {
  #https://github.com/git-for-windows/git/releases/download/v2.24.0.windows.2/Git-2.24.0.2-64-bit.exe
  $wc.DownloadFile("https://github.com/git-for-windows/git/releases/download/v$git_ver.windows.2/$git_exe", $path + "/downloads/$git_exe")
  & "downloads/$git_exe"
}

#$args = "--add Microsoft.VisualStudio.Workload.VCTools Microsoft.VisualStudio.Component.NuGet.BuildTools"

Write-Output "Downloading C++ build tools"
if(![System.IO.File]::Exists($path + "/downloads/vs_BuildTools.exe")) {
  #https://download.visualstudio.microsoft.com/download/pr/0ada7773-232e-4df0-b696-c9f628d08d83/cc0515d38477b47de088fde1270a17dc4b25401c33a3f031ba4e5a1728c83372/vs_BuildTools.exe
  $wc.DownloadFile("https://download.visualstudio.microsoft.com/download/pr/0ada7773-232e-4df0-b696-c9f628d08d83/cc0515d38477b47de088fde1270a17dc4b25401c33a3f031ba4e5a1728c83372/vs_BuildTools.exe", $path + "/downloads/vs_BuildTools.exe")
  & "downloads/vs_BuildTools.exe " --add Microsoft.VisualStudio.Workload.VCTools Microsoft.VisualStudio.Component.NuGet.BuildTools 
}

npm install --global yarn

Read-Host 'Press Enter once all installers have completed (warning! The directory "vortex" will be replaced if necessary!)...' | Out-Null

Write-Output "Refreshing Environment"

$wc.DownloadFile("https://raw.githubusercontent.com/chocolatey/chocolatey/master/src/redirects/RefreshEnv.cmd", $path + "/refreshenv.cmd")
.\refreshenv.cmd

if ([System.IO.File]::Exists($path + "package.json")) {
  Write-Output "Vortex repository already exists"
} else {
  Write-Output "Vortex repository does not exists, cloning..."
  git clone https://github.com/Nexus-Mods/Vortex.git vortex
}

Write-Output "Configuring the environment"

yarn config set msvs_version 2017 --global
yarn config set python python2.7 --global
npm config set python python2.7 --global

Write-Output "Building vortex"

if (![System.IO.File]::Exists($path + "package.json")) {
  Set-Location vortex
}

yarn install
yarn run build