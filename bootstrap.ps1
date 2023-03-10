#
# Configuration
#

# check compatibility with node-gyp
$python_ver = "3.11.2"
# current lts
$node_ver = "18.15.0"
# newest version available
$git_ver = "2.39.2"
# need at least the 2019 version
$msvs_ver = "2022"
# pretty sure any reasonably modern version is fine
$cmake_ver = "3.25.3"

trap [Exception] {
  write-host "We have an error!"
  if ($_.Exception.InnerException) {
    write-error $("ERROR: " + $_.Exception.InnerException.Message)
  } else {
    write-error $("ERROR: " + $_.Exception.Message)
  }
  Start-Sleep 30000
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

Read-Host 'Will now download and install all dependencies. There is no feedback during downloads.
All installers will start as soon as the download is finished but they may refuse to continue while others are running.

### Python
Please enable the option adding python to the PATH environment variable.

### Visual Studio
Under "Workloads", enable "Desktop Development with C++"
Under "Individual Components", enable ".NET 6.0 Runtime (LTS)", ".NET SDK", "C++ ATL for latest vXYZ build tools" and "Windows 1x SDK" (any version should be fine)

Please note that these options may get renamed in future installers
' | Out-Null

[Net.ServicePointManager]::SecurityProtocol += [Net.SecurityProtocolType]::Tls12

$wc = New-Object System.Net.WebClient

New-Item -ItemType Directory -Force -Path downloads

$python_exe = "python-$python_ver-amd64.exe"

$node_exe = "node-v$node_ver-x64.msi"

$cmake_exe = "cmake-$cmake_ver-windows-x86_64.msi"

$git_exe = "Git-$git_ver-64-bit.exe"

# the 2019 version does *NOT* work atm because the script to detect msbuild fails because MS puts it into a different, randomly selected, place on disk every release
# $build_tools_url = "https://download.visualstudio.microsoft.com/download/pr/6c56603d-6cb9-4f23-8d58-dcc8eb8b3563/34c42804299595c6bfef03ee68deff566d820d1c1fdf9aaeec40d2e3be9199df/vs_BuildTools.exe"
$build_tools_url = "https://aka.ms/vs/17/release/vs_BuildTools.exe"

if(![System.IO.File]::Exists($path + "/downloads/visualcppbuildtools_full.exe")) {
  Write-Output "Downloading c++ build tools"
  $wc.DownloadFile($build_tools_url, $path + "/downloads/visualcppbuildtools_full.exe")
  & "downloads/visualcppbuildtools_full.exe"
} else {
  Write-Output "C++ build tools already installed"
}

$python_url = "https://www.python.org/ftp/python/$python_ver/$python_exe"
if(![System.IO.File]::Exists($path + "/downloads/$python_exe")) {
  Write-Output "Downloading python $python_ver - $python_url"
  $wc.DownloadFile($python_url, $path + "/downloads/$python_exe")
  & "downloads/$python_exe"
} else {
  Write-Output "python already installed"
}

if(![System.IO.File]::Exists($path + "/downloads/$node_exe")) {
  Write-Output "Downloading node.js"
  $wc.DownloadFile("https://nodejs.org/dist/v$node_ver/$node_exe", $path + "/downloads/$node_exe")
  & "downloads/$node_exe"
} else {
  Write-Output "node.js already installed"
}

Write-Output "Downloading git"
if(![System.IO.File]::Exists($path + "/downloads/$git_exe")) {
  $wc.DownloadFile("https://github.com/git-for-windows/git/releases/download/v$git_ver.windows.1/$git_exe", $path + "/downloads/$git_exe")
  & "downloads/$git_exe"
}

Write-Output "Downloading cmake"
if(![System.IO.File]::Exists($path + "/downloads/$git_exe")) {
  $wc.DownloadFile("https://github.com/Kitware/CMake/releases/download/v$cmake_ver/$cmake_exe", $path + "/downloads/$cmake_exe")
  & "downloads/$cmake_exe"
}

Read-Host 'Press Enter once all installers have completed (warning! The directory "vortex" will be replaced if necessary!)...' | Out-Null

Write-Output "Refreshing Environment"

$wc.DownloadFile("https://raw.githubusercontent.com/chocolatey/chocolatey/master/src/redirects/RefreshEnv.cmd", $path + "/refreshenv.cmd")
.\refreshenv.cmd
# refreshenv is supposed to do the following but doesn't seem to work, not sure what's up with that
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") 

npm install --global yarn

#
# Clone and build vortex
#

Write-Output "Cloning vortex repo"

Remove-Item vortex -Recurse -Force -ErrorAction SilentlyContinue
git clone https://github.com/Nexus-Mods/Vortex.git vortex

Write-Output "Build vortex"
& yarn config set msvs_version $msvs_ver --global
cd vortex
& yarn install
& yarn run build
