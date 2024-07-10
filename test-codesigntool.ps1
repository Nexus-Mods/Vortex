function TestFile {
  param (
      [string]$Path
  )

  if (Test-Path $Path -PathType Leaf) {
      Write-Host "File exists: $Path";
  } else {
      Write-Error "File doesn't exist: $Path";
      exit 1;
  }
}

function TestDirectory {
  param (
      [string]$Path
  )

  if (Test-Path $Path -PathType Container) {
      Write-Host "Directory exists: $Path";
  } else {
      Write-Error "Directory doesn't exist: $Path";
      exit 1;
  }
}

$codeSignToolDir = [IO.Path]::GetFullPath(".\CodeSignTool")
TestDirectory($codeSignToolDir)

Set-Location $codeSignToolDir

& "$codeSignToolDir\CodeSignTool.bat" credential_info -username="$env:ES_USERNAME" -password="$env:ES_PASSWORD" -credential_id="$env:ES_CREDENTIAL_ID"

Set-Location ".."
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
  Write-Host "Signing test completed"
} else {
  Write-Error "Signing test failed with code $exitCode"
  exit $exitCode
}