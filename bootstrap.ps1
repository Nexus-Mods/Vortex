#
# Configuration
#

# has to be 2.7
$python_ver = "2.7.14"
# current lts
$node_ver = "8.9.4"
# newest version available
$git_ver = "2.15.1"

trap [Exception] {
  write-host "We have an error!"
  if ($_.Exception.InnerException) {
    write-error $("ERROR: " + $_.Exception.InnerException.Message)
  } else {
    write-error $("ERROR: " + $_.Exception.Message)
  }
  sleep 30
  break
}

[System.Reflection.Assembly]::LoadWithPartialName("System.windows.forms")

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.rootfolder = "MyComputer"

if($dialog.ShowDialog() -ne "OK") {
  exit
}

$path = $dialog.SelectedPath
cd $path

#
# Download and install dependencies
#

Write-Output "Downloading dependencies. There is no feedback during downloads!"

$wc = New-Object System.Net.WebClient

New-Item -ItemType Directory -Force -Path downloads

$python_exe = "python-$python_ver.amd64.msi"

$node_exe = "node-v$node_ver-x64.msi"

$git_exe = "Git-$git_ver.2-64-bit.exe"

Write-Output "Downloading c++ build tools"
if(![System.IO.File]::Exists("downloads/visualcppbuildtools_full.exe")) {
  $wc.DownloadFile("https://download.microsoft.com/download/5/f/7/5f7acaeb-8363-451f-9425-68a90f98b238/visualcppbuildtools_full.exe", $path + "/downloads/visualcppbuildtools_full.exe")
  & "downloads/visualcppbuildtools_full.exe"
}

Write-Output "Downloading python $python_ver"
if(![System.IO.File]::Exists("downloads/$python_exe")) {
  $wc.DownloadFile("https://www.python.org/ftp/python/$python_ver/$python_exe", $path + "/downloads/$python_exe")
  & "downloads/$python_exe"
}

Write-Output "Downloading node.js"
if(![System.IO.File]::Exists("downloads/$node_exe")) {
  $wc.DownloadFile("https://nodejs.org/dist/v$node_ver/$node_exe", $path + "/downloads/$node_exe")
  & "downloads/$node_exe"
}

Write-Output "Downloading git"
if(![System.IO.File]::Exists("downloads/$git_exe")) {
  $wc.DownloadFile("https://github.com/git-for-windows/git/releases/download/v$git_ver.windows.2/$git_exe", $path + "/downloads/$git_exe")
  & "downloads/$git_exe"
}

npm install --global yarn

Read-Host 'Press Enter once all installers have completed (warning! The directory "vortex" will be replaced if necessary!)...' | Out-Null

Write-Output "Refreshing Environment"

$wc.DownloadFile("https://raw.githubusercontent.com/chocolatey/chocolatey/master/src/redirects/RefreshEnv.cmd", $path + "/refreshenv.cmd")
.\refreshenv.cmd

#
# Clone and build vortex
#

Write-Output "Cloning vortex repo"

Remove-Item vortex -Recurse -Force -ErrorAction SilentlyContinue
git clone https://github.com/Nexus-Mods/Vortex.git vortex

Write-Output "Build vortex"
& yarn config set msvs_version 2015 --global
cd vortex
& yarn install
& yarn run build
