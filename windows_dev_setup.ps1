# Windows Development Environment Bootstrap
# Installs: Git, Python 3.10, CMake, VS 2022 Build Tools + Windows SDK, NVM, Node 18.20.4, Yarn 1.x
# Then clones/updates Vortex repository

#Requires -RunAsAdministrator

# Configuration
$WindowsSDKVer = "19041"
$RepoUrl = "https://github.com/Nexus-Mods/Vortex.git"
$Branch = "master"
$Directory = "C:\vortex"
$RetryAttempts = 3
$RetryDelay = 5

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Logging function with consistent formatting
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "SUCCESS", "WARN", "ERROR", "STEP")]
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $prefix = switch ($Level) {
        "STEP"    { "[STEP]   "; "Cyan" }
        "SUCCESS" { "[OK]     "; "Green" }
        "WARN"    { "[WARN]   "; "Yellow" }
        "ERROR"   { "[ERROR]  "; "Red" }
        default   { "[INFO]   "; "White" }
    }
    
    Write-Host "$timestamp $($prefix[0])$Message" -ForegroundColor $prefix[1]
}

# Utility Functions
function Test-AdminRights {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-WingetAvailable {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Log "winget not found. Install 'App Installer' from Microsoft Store and retry." "ERROR"
        throw "winget is required but not available"
    }
}

function Add-ToPathPermanently {
    param([string]$Path, [string]$Scope = "Machine")
    
    if (-not $Path -or -not (Test-Path $Path)) {
        Write-Log "Skipping invalid path: $Path" "WARN"
        return
    }

    $currentPath = [Environment]::GetEnvironmentVariable("Path", $Scope)
    if ($currentPath -split ';' -contains $Path) {
        return  # Already in PATH
    }
    
    $newPath = "$currentPath;$Path"
    [Environment]::SetEnvironmentVariable("Path", $newPath, $Scope)
    $env:Path = "$Path;$env:Path"
    Write-Log "Added to PATH: $Path" "SUCCESS"
}

function Invoke-WithRetry {
    param(
        [scriptblock]$ScriptBlock,
        [string]$Operation,
        [int]$MaxAttempts = $RetryAttempts
    )
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            if ($attempt -gt 1) {
                Write-Log "$Operation (retry $attempt/$MaxAttempts)" "INFO"
            }
            & $ScriptBlock
            return
        }
        catch {
            if ($attempt -eq $MaxAttempts) {
                throw "Failed after $MaxAttempts attempts: $($_.Exception.Message)"
            }
            Write-Log "$Operation failed, retrying in ${RetryDelay}s: $($_.Exception.Message)" "WARN"
            Start-Sleep -Seconds $RetryDelay
        }
    }
}

# Installation Functions
function Install-Git {
    Write-Log "Checking Git installation..." "STEP"
    
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $version = git --version
        Write-Log "Git already installed: $version" "SUCCESS"
        return
    }
    
    Invoke-WithRetry -Operation "Git installation" -ScriptBlock {
        winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
        Start-Sleep -Seconds 3
        
        # Add Git to PATH
        @("$env:ProgramFiles\Git\cmd", "${env:ProgramFiles(x86)}\Git\cmd") | ForEach-Object {
            if (Test-Path "$_\git.exe") { Add-ToPathPermanently -Path $_ }
        }
        
        # Refresh PATH
        $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
        
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            throw "Git command not found after installation"
        }
    }
    
    Write-Log "Git installed: $(git --version)" "SUCCESS"
}

function Install-Python310 {
    Write-Log "Checking Python 3.10 installation..." "STEP"
    
    # Check for existing Python 3.10
    $pythonCommands = @({ py -3.10 -V }, { python --version }, { python3.10 --version })
    foreach ($cmd in $pythonCommands) {
        try {
            $version = & $cmd 2>&1
            if ($version -match 'Python 3\.10\.\d+') {
                Write-Log "Python 3.10 already installed: $version" "SUCCESS"
                return
            }
        } catch { }
    }
    
    Invoke-WithRetry -Operation "Python 3.10 installation" -ScriptBlock {
        winget install --id Python.Python.3.10 -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
        Start-Sleep -Seconds 3
        
        # Verify installation
        $pythonFound = $false
        foreach ($cmd in $pythonCommands) {
            try {
                $version = & $cmd 2>&1
                if ($version -match 'Python 3\.10\.\d+') {
                    $pythonFound = $true
                    break
                }
            } catch { }
        }
        
        if (-not $pythonFound) {
            throw "Python 3.10 verification failed"
        }
    }
    
    Write-Log "Python 3.10 installed successfully" "SUCCESS"
}

function Install-CMake {
    Write-Log "Checking CMake installation..." "STEP"
    
    if (Get-Command cmake -ErrorAction SilentlyContinue) {
        $version = cmake --version | Select-Object -First 1
        Write-Log "CMake already installed: $version" "SUCCESS"
        return
    }
    
    Invoke-WithRetry -Operation "CMake installation" -ScriptBlock {
        winget install --id Kitware.CMake -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
        Start-Sleep -Seconds 3
        
        # Add CMake to PATH
        @("$env:ProgramFiles\CMake\bin", "${env:ProgramFiles(x86)}\CMake\bin") | ForEach-Object {
            if (Test-Path "$_\cmake.exe") { 
                Add-ToPathPermanently -Path $_
                break
            }
        }
        
        # Refresh PATH
        $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
        
        if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
            throw "CMake command not found after installation"
        }
    }
    
    Write-Log "CMake installed: $(cmake --version | Select-Object -First 1)" "SUCCESS"
}

function Install-VisualStudioBuildTools {
    Write-Log "Checking Visual Studio Build Tools..." "STEP"
    
    # Use vswhere to detect existing Build Tools
    $buildToolsInstalled = $false
    $buildToolsPath = $null
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    
    if (Test-Path $vswhere) {
        try {
            $buildToolsInstances = & $vswhere -products Microsoft.VisualStudio.Product.BuildTools -format json 2>$null | ConvertFrom-Json
            if ($buildToolsInstances -and $buildToolsInstances.Count -gt 0) {
                $buildToolsInstalled = $true
                $buildToolsPath = $buildToolsInstances[0].installationPath
                Write-Log "Build Tools detected at: $buildToolsPath" "SUCCESS"
            }
        }
        catch {
            Write-Log "vswhere query failed, using fallback detection" "WARN"
        }
    }
    
    # Fallback detection
    if (-not $buildToolsInstalled) {
        $fallbackPaths = @(
            "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools",
            "C:\Program Files\Microsoft Visual Studio\2022\BuildTools"
        )
        foreach ($path in $fallbackPaths) {
            if (Test-Path "$path\MSBuild\Current\Bin\MSBuild.exe") {
                $buildToolsInstalled = $true
                $buildToolsPath = $path
                Write-Log "Build Tools detected at: $path" "SUCCESS"
                break
            }
        }
    }
    
    $components = @(
        "Microsoft.VisualStudio.Workload.VCTools",
        "Microsoft.NetCore.Component.Runtime.6.0", 
        "Microsoft.NetCore.Component.SDK",
        "Microsoft.VisualStudio.Component.VC.ATL",
        "Microsoft.VisualStudio.Component.Windows10SDK.$WindowsSDKVer"
    )
    
    if ($buildToolsInstalled) {
        Write-Log "Modifying existing Build Tools to add required components..." "INFO"
        
        $installerPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vs_installer.exe"
        if (-not (Test-Path $installerPath)) {
            Write-Log "VS Installer not found, components may already be present" "WARN"
            return
        }
        
        $modifyArgs = @("modify", "--installPath", "`"$buildToolsPath`"")
        foreach ($component in $components) {
            $modifyArgs += "--add", $component
        }
        $modifyArgs += "--includeRecommended", "--passive", "--norestart"
        
        Invoke-WithRetry -Operation "Build Tools modification" -ScriptBlock {
            $process = Start-Process -FilePath $installerPath -ArgumentList $modifyArgs -Wait -PassThru -NoNewWindow
            if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {
                throw "VS Installer failed with exit code: $($process.ExitCode)"
            }
        }
    } else {
        Write-Log "Installing Visual Studio 2022 Build Tools..." "INFO"
        
        $installArgs = @("--passive", "--norestart")
        foreach ($component in $components) {
            $installArgs += "--add", $component
        }
        $installArgs += "--includeRecommended", "--remove", "Microsoft.VisualStudio.Component.VC.CMake.Project"
        
        Invoke-WithRetry -Operation "Build Tools installation" -ScriptBlock {
            winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements --override ($installArgs -join ' ')
        }
    }
    
    Write-Log "Visual Studio Build Tools ready" "SUCCESS"
}

function Install-NVMAndNode {
    Write-Log "Setting up NVM and Node.js 18.20.4..." "STEP"
    
    # Install NVM if not present
    if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
        Write-Log "Installing NVM for Windows..." "INFO"
        Invoke-WithRetry -Operation "NVM installation" -ScriptBlock {
            winget install --id CoreyButler.NVMforWindows -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
            Start-Sleep -Seconds 5
        }
    }
    
    # Repair NVM settings if needed
    $nvmRoot = $env:NVM_HOME
    if (-not $nvmRoot -or -not (Test-Path "$nvmRoot\nvm.exe")) {
        $possiblePaths = @("$env:APPDATA\nvm", "$env:ProgramFiles\nvm", "${env:ProgramFiles(x86)}\nvm")
        foreach ($path in $possiblePaths) {
            if (Test-Path "$path\nvm.exe") {
                $nvmRoot = $path
                break
            }
        }
    }
    
    if ($nvmRoot) {
        [Environment]::SetEnvironmentVariable("NVM_HOME", $nvmRoot, "Machine")
        [Environment]::SetEnvironmentVariable("NVM_SYMLINK", "C:\Program Files\nodejs", "Machine")
        Add-ToPathPermanently -Path $nvmRoot
        Add-ToPathPermanently -Path "C:\Program Files\nodejs"
        
        # Ensure settings.txt exists
        $settingsPath = "$nvmRoot\settings.txt"
        if (-not (Test-Path $settingsPath) -or (Get-Content $settingsPath -Raw -ErrorAction SilentlyContinue).Length -eq 0) {
            "root: $nvmRoot`npath: C:\Program Files\nodejs`narch: 64`nproxy: none" | Out-File -FilePath $settingsPath -Encoding ASCII -Force
        }
    }
    
    # Refresh PATH
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    
    if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
        throw "NVM installation failed"
    }
    
    # Install and activate Node.js 18.20.4
    try {
        $nvmList = nvm list 2>&1 | Out-String
        if ($nvmList -notmatch "18\.20\.4") {
            Write-Log "Installing Node.js 18.20.4..." "INFO"
            nvm install 18.20.4 | Out-Null
            Start-Sleep -Seconds 3
        }
        
        nvm use 18.20.4 | Out-Null
        Start-Sleep -Seconds 2
        
        # Wait for Node to become available
        $nodeFound = $false
        for ($i = 1; $i -le 5; $i++) {
            if (Get-Command node -ErrorAction SilentlyContinue) {
                $nodeFound = $true
                break
            }
            Start-Sleep -Seconds 2
        }
        
        if (-not $nodeFound) {
            throw "Node.js not available after activation"
        }
        
        $nodeVersion = node -v
        Write-Log "Node.js active: $nodeVersion" "SUCCESS"
        
    } catch {
        throw "Node.js setup failed: $($_.Exception.Message)"
    }
}

function Install-Yarn {
    Write-Log "Installing Yarn 1.x..." "STEP"
    
    try {
        $yarnVersion = yarn -v 2>&1
        if ($yarnVersion -match '^1\.') {
            Write-Log "Yarn 1.x already installed: $yarnVersion" "SUCCESS"
            return
        }
    } catch { }
    
    Invoke-WithRetry -Operation "Yarn installation" -ScriptBlock {
        try {
            corepack enable | Out-Null
            corepack prepare yarn@1.22.22 --activate | Out-Null
        } catch {
            npm install -g yarn@1.22.22 | Out-Null
        }
        
        Start-Sleep -Seconds 2
        $version = yarn -v 2>&1
        if ($version -notmatch '^1\.') {
            throw "Yarn 1.x installation verification failed"
        }
    }
    
    Write-Log "Yarn installed: $(yarn -v)" "SUCCESS"
}

function Set-NodeGyp {
    Write-Log "Configuring node-gyp for Visual Studio 2022..." "STEP"
    
    # Find VS installation path using vswhere
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    $vsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"  # Default fallback
    
    if (Test-Path $vswhere) {
        try {
            $detectedPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
            if ($detectedPath) { $vsPath = $detectedPath }
        } catch { }
    }
    
    # Set environment variables
    $gypVars = @{
        "npm_config_msvs_version" = "2022"
        "GYP_MSVS_VERSION" = "2022"
        "GYP_MSVS_OVERRIDE_PATH" = $vsPath
    }
    
    foreach ($var in $gypVars.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($var.Key, $var.Value, "Machine")
        Set-Item "env:$($var.Key)" $var.Value
    }
    
    # Add MSBuild to PATH
    $msbuildPath = "$vsPath\MSBuild\Current\Bin"
    if (Test-Path $msbuildPath) {
        Add-ToPathPermanently -Path $msbuildPath
    }
    
    # Create .npmrc
    "msvs_version=2022" | Out-File -FilePath "$env:USERPROFILE\.npmrc" -Encoding ASCII -Force
    
    Write-Log "node-gyp configured for VS 2022" "SUCCESS"
}

function Update-Repository {
    Write-Log "Setting up Vortex repository..." "STEP"
    
    New-Item -ItemType Directory -Force -Path $Directory | Out-Null
    $repoPath = "$Directory\Vortex"
    
    if (Test-Path "$repoPath\.git") {
        Write-Log "Updating existing repository..." "INFO"
        git -C $repoPath fetch origin
        git -C $repoPath checkout $Branch
        git -C $repoPath pull --ff-only
    } else {
        Write-Log "Cloning repository..." "INFO"
        git clone -b $Branch $RepoUrl $repoPath
    }
    
    # Update submodules if present
    if (Test-Path "$repoPath\.gitmodules") {
        git -C $repoPath submodule update --init --recursive
    }
    
    # Create project .npmrc
    if (-not (Test-Path "$repoPath\.npmrc")) {
        "msvs_version=2022" | Out-File -FilePath "$repoPath\.npmrc" -Encoding ASCII -Force
    }
    
    Write-Log "Repository ready at: $repoPath" "SUCCESS"
}

function Show-Summary {
    Write-Log "" "INFO"
    Write-Log "=== INSTALLATION COMPLETE ===" "SUCCESS"
    Write-Log "" "INFO"
    
    # Check and display versions
    $tools = @{
        "Git" = { git --version 2>&1 }
        "Python" = { py -3.10 -V 2>&1 }
        "CMake" = { (cmake --version | Select-Object -First 1) 2>&1 }
        "Node.js" = { node -v 2>&1 }
        "NPM" = { npm -v 2>&1 }
        "Yarn" = { yarn -v 2>&1 }
    }
    
    Write-Log "Installed Tools:" "INFO"
    foreach ($tool in $tools.GetEnumerator()) {
        try {
            $version = & $tool.Value
            Write-Host "  [OK]  $($tool.Key): $version" -ForegroundColor Green
        }
        catch {
            Write-Host "  [ERR] $($tool.Key): Not available" -ForegroundColor Red
        }
    }
    
    Write-Log "" "INFO"
    Write-Log "Next Steps:" "INFO"
    Write-Host "  1. cd C:\vortex\Vortex" -ForegroundColor Cyan
    Write-Host "  2. yarn install" -ForegroundColor Cyan  
    Write-Host "  3. yarn build" -ForegroundColor Cyan
    Write-Log "" "INFO"
    Write-Log "Repository location: C:\vortex\Vortex" "INFO"
    Write-Log "Bootstrap completed successfully!" "SUCCESS"
}

# Main Execution
try {
    Write-Log "Starting Windows Development Environment Bootstrap" "STEP"
    Write-Log "This will install: Git, Python 3.10, CMake, VS Build Tools, NVM, Node.js 18.20.4, Yarn" "INFO"
    Write-Log "" "INFO"
    
    # Prerequisites check
    if (-not (Test-AdminRights)) {
        throw "Administrator privileges required. Please run PowerShell as Administrator."
    }
    Test-WingetAvailable
    
    # Install all components
    Install-Git
    Install-Python310  
    Install-CMake
    Install-VisualStudioBuildTools
    Install-NVMAndNode
    Install-Yarn
    Set-NodeGyp
    Update-Repository
    
    # Final summary
    Show-Summary
    
} catch {
    Write-Log "" "ERROR"
    Write-Log "Bootstrap failed: $($_.Exception.Message)" "ERROR"
    Write-Log "" "ERROR"
    Write-Log "Troubleshooting:" "ERROR"
    Write-Log "- Run the script again (it handles partial installations)" "ERROR"
    Write-Log "- Ensure winget is installed (Microsoft Store > App Installer)" "ERROR"
    Write-Log "- Check Windows Defender is not blocking installations" "ERROR"
    Write-Log "- Try running individual install commands manually" "ERROR"
    exit 1
}