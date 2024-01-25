Set-StrictMode -Version 'Latest'
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue' #'Continue

$rootDir = Resolve-Path "."
$downloadUrl = "https://launcher-public-service-prod06.ol.epicgames.com/launcher/api/installer/download/BuildPatchTool.zip"
$downloadedFile = Join-Path $rootDir "BuildPatchTool.zip"
$extractFolder = Join-Path $rootDir "BuildPatchTool"
$binaryPath = Join-Path $extractFolder "Engine/Binaries/Win64/BuildPatchTool.exe"

Write-Host "rootDir $rootDir"
Write-Host "downloadedFile $downloadedFile"
Write-Host "extractFolder $extractFolder"
Write-Host "binaryPath $binaryPath"

# Remove extracted folder if exists, just in case (mainly used locally)
if(Test-Path $extractFolder) {
    Remove-Item -Path $extractFolder -Recurse -Force
}

# Download (if it doesn't exist)
if(!(Test-Path $downloadedFile -PathType Leaf)) {
    Invoke-WebRequest -OutFile $downloadedFile $downloadUrl
}
        
# Extract
Expand-Archive -Path $downloadedFile -DestinationPath $extractFolder -Force