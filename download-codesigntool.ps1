param (
  [switch] $Sandbox
)

Set-StrictMode -Version 'Latest'
$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue' #'Continue

Write-Host "Sandbox = $Sandbox"
        
$rootDir = Resolve-Path "."
$downloadUrl = "https://www.ssl.com/download/codesigntool-for-windows/"
$downloadedFile = Join-Path $rootDir "CodeSignTool.zip"
$extractFolder = Join-Path $rootDir "CodeSignTool"
$configPath = "/conf/code_sign_tool.properties"

Write-Host "rootDir $rootDir"
Write-Host "downloadedFile $downloadedFile"
Write-Host "extractFolder $extractFolder"

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
  
# need to check for a nested single folder as 1.2.7 was packaged without this, all previous versions were not.

$folderCount = @(Get-ChildItem $extractFolder -Directory ).Count;

#if we have a single folder, then assume we have a nested folder that we need to fix
If ($folderCount -eq 1) {

    # get nested folder path, there is only 1 at this point
    $nestedFolderPath = (Get-ChildItem $extractFolder -Directory | Select-Object FullName)[0].FullName

    Write-Host "nestedFolderPath $nestedFolderPath"

    # move all child items from this nested folder to it's parent
    Get-ChildItem -Path $nestedFolderPath -Recurse | Move-Item -Destination $extractFolder

    # remove nested folder to keep it clean
    Remove-Item -Path $nestedFolderPath -Force
}

# Set config to sandbox (only while testing)
if($Sandbox -eq $true) {
 
    $codeSignToolPropertiesFile = Join-Path $extractFolder $configPath

    $null = New-Item -Path $codeSignToolPropertiesFile -ItemType File -Force
    Add-Content -Path $codeSignToolPropertiesFile -Value "CLIENT_ID=qOUeZCCzSqgA93acB3LYq6lBNjgZdiOxQc-KayC3UMw"
    Add-Content -Path $codeSignToolPropertiesFile -Value "OAUTH2_ENDPOINT=https://oauth-sandbox.ssl.com/oauth2/token"
    Add-Content -Path $codeSignToolPropertiesFile -Value "CSC_API_ENDPOINT=https://cs-try.ssl.com"
    Add-Content -Path $codeSignToolPropertiesFile -Value "TSA_URL=http://ts.ssl.com"
}
