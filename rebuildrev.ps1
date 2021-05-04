$cores = 8

$pass = Read-Host 'Key password?' -AsSecureString

$ErrorActionPreference = "Stop"

$sw = [Diagnostics.Stopwatch]::StartNew()

# don't use core clr. For some reason edge seems to prefer that when building from powershell?
$env:EDGE_USE_CORECLR = 0

$env:WIN_CSC_LINK = "c:\work\Signing\vortex.pfx"

# this is for signing other exes we ship. It assumes the certificate has been imported into the windows
# certificate manager
$env:SIGN_TOOL = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.17763.0\x64\SignTool.exe"
$env:SIGN_THUMBPRINT = "0399da4f524f84e66b1270fba5b678c98b343001"

# Invoke-Expression -Command 'yarn install' -ErrorAction Continue
# Invoke-Expression -Command 'yarn dist' -ErrorAction Continue

& yarn install --build-from-source

Write-Host "yarn install " $sw.Elapsed

$env:CSC_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pass))
Invoke-Command {cmd /C "yarn dist"}

Write-Host "done " $sw.Elapsed
