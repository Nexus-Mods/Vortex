# Dev environment bootstrap (Windows) - NVM only, no Volta
# Installs prerequisites if needed: Git, Python 3.10, CMake, VS 2022 Build Tools + Windows SDKs,
# NVM for Windows, Node 18.20.4, Yarn 1.x. Then clones or updates the repo.

# Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process


# Configuration constants
$WindowsSDKVer = "19041"  # Windows SDK version to install, MS BuildTools only has this version
$RepoUrl = "https://github.com/Nexus-Mods/Vortex.git"
$Branch = "master"
$Directory = "C:\vortex"
$RetryAttempts = 3
$RetryDelay = 5

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARN" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

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
    Write-Log "winget is available" "SUCCESS"
}

function Add-ToPathPermanently {
    param(
        [string]$Path,
        [ValidateSet("User", "Machine")]
        [string]$Scope = "Machine"
    )
    
    if (-not $Path -or -not (Test-Path $Path)) {
        Write-Log "Path does not exist: $Path" "WARN"
        return
    }

    $currentPath = [Environment]::GetEnvironmentVariable("Path", $Scope)
    $pathArray = $currentPath -split ';' | Where-Object { $_ -ne '' }
    
    if ($pathArray -contains $Path) {
        Write-Log "Path already in $Scope PATH: $Path"
        return
    }
    
    $newPath = ($pathArray + $Path) -join ';'
    try {
        [Environment]::SetEnvironmentVariable("Path", $newPath, $Scope)
        $env:Path = "$Path;$env:Path"
        Write-Log "Added to $Scope PATH: $Path" "SUCCESS"
    }
    catch {
        Write-Log "Failed to add to $Scope PATH: $Path - $($_.Exception.Message)" "ERROR"
    }
}

function Invoke-WithRetry {
    param(
        [scriptblock]$ScriptBlock,
        [int]$MaxAttempts = $RetryAttempts,
        [int]$DelaySeconds = $RetryDelay,
        [string]$Operation = "Operation"
    )
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            Write-Log "Attempting $Operation (attempt $attempt/$MaxAttempts)"
            & $ScriptBlock
            Write-Log "$Operation completed successfully" "SUCCESS"
            return
        }
        catch {
            Write-Log "$Operation failed on attempt $attempt`: $($_.Exception.Message)" "WARN"
            if ($attempt -eq $MaxAttempts) {
                Write-Log "$Operation failed after $MaxAttempts attempts" "ERROR"
                throw
            }
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

function Install-Git {
    Write-Log "Installing Git"
    
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $version = git --version
        Write-Log "Git already installed: $version" "SUCCESS"
        return
    }
    
    Invoke-WithRetry -Operation "Git installation" -ScriptBlock {
        winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
    }
    
    Start-Sleep -Seconds 3
    
    $gitPaths = @(
        "$env:ProgramFiles\Git\cmd",
        "$env:ProgramFiles\Git\bin",
        "${env:ProgramFiles(x86)}\Git\cmd",
        "${env:ProgramFiles(x86)}\Git\bin"
    )
    
    foreach ($path in $gitPaths) {
        if (Test-Path "$path\git.exe") {
            Add-ToPathPermanently -Path $path
        }
    }
    
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "Git installation failed - command not found after installation"
    }
    
    $version = git --version
    Write-Log "Git installed successfully: $version" "SUCCESS"
}

function Install-Python310 {
    Write-Log "Installing Python 3.10"
    
    $pythonCommands = @(
        { & py -3.10 -V },
        { & python --version },
        { & python3.10 --version }
    )
    
    foreach ($cmd in $pythonCommands) {
        try {
            $version = & $cmd 2>&1
            if ($version -match 'Python 3\.10\.\d+') {
                Write-Log "Python 3.10 already installed: $version" "SUCCESS"
                return
            }
        }
        catch { }
    }
    
    Invoke-WithRetry -Operation "Python 3.10 installation" -ScriptBlock {
        winget install --id Python.Python.3.10 -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
    }
    
    Start-Sleep -Seconds 3
    
    $pythonFound = $false
    foreach ($cmd in $pythonCommands) {
        try {
            $version = & $cmd 2>&1
            if ($version -match 'Python 3\.10\.\d+') {
                Write-Log "Python 3.10 installed successfully: $version" "SUCCESS"
                $pythonFound = $true
                break
            }
        }
        catch { }
    }
    
    if (-not $pythonFound) {
        throw "Python 3.10 installation failed - no working Python 3.10 found"
    }
}

function Install-CMake {
    Write-Log "Installing CMake"
    
    if (Get-Command cmake -ErrorAction SilentlyContinue) {
        $version = (cmake --version | Select-Object -First 1)
        Write-Log "CMake already installed: $version" "SUCCESS"
        return
    }
    
    Invoke-WithRetry -Operation "CMake installation" -ScriptBlock {
        winget install --id Kitware.CMake -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
    }
    
    Start-Sleep -Seconds 3
    
    $cmakePaths = @(
        "$env:ProgramFiles\CMake\bin",
        "${env:ProgramFiles(x86)}\CMake\bin"
    )
    
    $registryKeys = @(
        "HKLM:\SOFTWARE\Kitware\CMake",
        "HKLM:\SOFTWARE\WOW6432Node\Kitware\CMake"
    )
    
    foreach ($key in $registryKeys) {
        try {
            $installDir = (Get-ItemProperty -Path $key -ErrorAction Stop).InstallDir
            if ($installDir) {
                $cmakePaths += "$installDir\bin"
            }
        }
        catch { }
    }
    
    foreach ($path in $cmakePaths) {
        if (Test-Path "$path\cmake.exe") {
            Add-ToPathPermanently -Path $path
            break
        }
    }
    
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    
    if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
        throw "CMake installation failed - command not found after installation"
    }
    
    $version = (cmake --version | Select-Object -First 1)
    Write-Log "CMake installed successfully: $version" "SUCCESS"
}
function Install-VisualStudioBuildTools {
    Write-Log "Installing/Modifying Visual Studio 2022 Build Tools"
    
    # Check if Build Tools are already installed
    $buildToolsInstalled = $false
    $installerPath = $null
    
    # Check via winget first
    try {
        $wingetList = winget list --id Microsoft.VisualStudio.2022.BuildTools --accept-source-agreements 2>&1 | Out-String
        if ($wingetList -match "Microsoft.VisualStudio.2022.BuildTools") {
            $buildToolsInstalled = $true
            Write-Log "Build Tools detected via winget" "SUCCESS"
        }
    }
    catch { }
    
    # Check via file system if winget detection failed
    if (-not $buildToolsInstalled) {
        # Try to find Build Tools installation
        $buildToolsPaths = @(
            "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools",
            "C:\Program Files\Microsoft Visual Studio\2022\BuildTools"
        )
        foreach ($path in $buildToolsPaths) {
            if (Test-Path "$path\MSBuild\Current\Bin\MSBuild.exe") {
                $buildToolsInstalled = $true
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
        Write-Log "Build Tools already installed, modifying installation to ensure required components" "SUCCESS"
        
        # Find the vs_buildtools.exe installer
        $possibleInstallers = @(
            "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\vs_buildtools.exe",
            "${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\vs_buildtools.exe"
        )
        
        foreach ($installer in $possibleInstallers) {
            if (Test-Path $installer) {
                $installerPath = $installer
                break
            }
        }
        
        # If we can't find the specific installer, try the generic vs_installer
        if (-not $installerPath) {
            $genericInstaller = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vs_installer.exe"
            if (Test-Path $genericInstaller) {
                $installerPath = $genericInstaller
            }
        }
        
        if ($installerPath) {
            Write-Log "Using installer: $installerPath"
            
            # Build modify command arguments
            $modifyArgs = @("modify", "--installPath")
            
            # Find the actual installation path
            $buildToolsPath = $null
            $searchPaths = @(
                "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools",
                "C:\Program Files\Microsoft Visual Studio\2022\BuildTools"
            )
            
            foreach ($path in $searchPaths) {
                if (Test-Path "$path\MSBuild\Current\Bin\MSBuild.exe") {
                    $buildToolsPath = $path
                    break
                }
            }
            
            if ($buildToolsPath) {
                $modifyArgs += "`"$buildToolsPath`""
            } else {
                # Fallback to default path
                $modifyArgs += "`"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`""
            }
            
            # Add components
            foreach ($component in $components) {
                $modifyArgs += "--add"
                $modifyArgs += $component
            }
            
            $modifyArgs += @("--includeRecommended", "--passive", "--norestart")
            
            Write-Log "Modify command: $installerPath $($modifyArgs -join ' ')"
            
            Invoke-WithRetry -Operation "Visual Studio Build Tools modification" -ScriptBlock {
                Write-Log "Executing: $installerPath $($modifyArgs -join ' ')"
                $process = Start-Process -FilePath $installerPath -ArgumentList $modifyArgs -Wait -PassThru -NoNewWindow
                Write-Log "Installer exit code: $($process.ExitCode)"
                if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 3010) {  # 3010 = success but reboot required
                    throw "Installer failed with exit code: $($process.ExitCode)"
                }
            }
        } else {
            Write-Log "Could not find VS installer, components may already be installed or manual verification needed" "WARN"
        }
    } else {
        Write-Log "Installing fresh Visual Studio 2022 Build Tools"
        
        # Fresh installation using winget
        $installArgs = @("--passive", "--norestart")
        
        foreach ($component in $components) {
            $installArgs += "--add"
            $installArgs += $component
        }
        
        $installArgs += "--includeRecommended"
        $installArgs += "--remove"
        $installArgs += "Microsoft.VisualStudio.Component.VC.CMake.Project"
        
        $overrideArgs = $installArgs -join ' '
        Write-Log "Fresh install arguments: $overrideArgs"
        
        Invoke-WithRetry -Operation "Visual Studio Build Tools installation" -ScriptBlock {
            winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements --override $overrideArgs
        }
    }
    
    Write-Log "Visual Studio 2022 Build Tools installation/modification completed" "SUCCESS"
}

function Repair-NVMSettings {
    Write-Log "Checking and repairing NVM settings"
    
    $nvmRoot = $null
    $possiblePaths = @(
        $env:NVM_HOME,
        "C:\Users\$env:USERNAME\AppData\Roaming\nvm",
        "$env:ProgramFiles\nvm",
        "${env:ProgramFiles(x86)}\nvm",
        "$env:APPDATA\nvm"
    )
    
    foreach ($path in $possiblePaths) {
        if ($path -and (Test-Path "$path\nvm.exe")) {
            $nvmRoot = $path
            break
        }
    }
    
    if (-not $nvmRoot) {
        try {
            $uninstallKeys = Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction SilentlyContinue
            foreach ($key in $uninstallKeys) {
                $app = Get-ItemProperty $key.PSPath -ErrorAction SilentlyContinue
                if ($app.DisplayName -like "NVM for Windows*" -and $app.InstallLocation) {
                    if (Test-Path "$($app.InstallLocation)\nvm.exe") {
                        $nvmRoot = $app.InstallLocation
                        break
                    }
                }
            }
        }
        catch { }
    }
    
    if (-not $nvmRoot) {
        throw "Could not find NVM installation directory"
    }
    
    Write-Log "Found NVM at: $nvmRoot"
    
    $settingsPath = Join-Path $nvmRoot "settings.txt"
    
    if (-not (Test-Path $settingsPath)) {
        Write-Log "Creating missing settings.txt file"
        
        $nodeSymlinkPath = "C:\Program Files\nodejs"
        $settingsContent = "root: $nvmRoot`npath: $nodeSymlinkPath`narch: 64`nproxy: none"
        
        try {
            $settingsContent | Out-File -FilePath $settingsPath -Encoding ASCII -Force
            Write-Log "Created settings.txt at: $settingsPath" "SUCCESS"
        }
        catch {
            throw "Failed to create settings.txt: $($_.Exception.Message)"
        }
    }
    else {
        Write-Log "settings.txt already exists at: $settingsPath"
        
        $settingsContent = Get-Content $settingsPath -Raw -ErrorAction SilentlyContinue
        if (-not $settingsContent -or $settingsContent.Length -eq 0) {
            Write-Log "settings.txt is empty, recreating..." "WARN"
            $nodeSymlinkPath = "C:\Program Files\nodejs"
            $newSettingsContent = "root: $nvmRoot`npath: $nodeSymlinkPath`narch: 64`nproxy: none"
            $newSettingsContent | Out-File -FilePath $settingsPath -Encoding ASCII -Force
            Write-Log "Recreated settings.txt" "SUCCESS"
        }
    }
    
    [Environment]::SetEnvironmentVariable("NVM_HOME", $nvmRoot, "Machine")
    [Environment]::SetEnvironmentVariable("NVM_SYMLINK", "C:\Program Files\nodejs", "Machine")
    $env:NVM_HOME = $nvmRoot
    $env:NVM_SYMLINK = "C:\Program Files\nodejs"
    
    Add-ToPathPermanently -Path $nvmRoot
    Add-ToPathPermanently -Path "C:\Program Files\nodejs"
    
    Write-Log "NVM settings configured successfully" "SUCCESS"
}

function Install-NVMAndNode {
    Write-Log "Installing NVM for Windows and Node 18.20.4"
    
    if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
        Write-Log "NVM not found, installing..."
        Invoke-WithRetry -Operation "NVM installation" -ScriptBlock {
            winget install --id CoreyButler.NVMforWindows -e --accept-package-agreements --accept-source-agreements --silent | Out-Null
        }
        Start-Sleep -Seconds 5
    }
    else {
        Write-Log "NVM already available" "SUCCESS"
    }
    
    try {
        Repair-NVMSettings
    }
    catch {
        Write-Log "NVM settings repair failed: $($_.Exception.Message)" "ERROR"
    }
    
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    
    if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
        throw "NVM installation failed - command not found after installation"
    }
    
    try {
        Write-Log "Checking installed Node.js versions"
        
        $nvmVersionOutput = ""
        try {
            $nvmVersionOutput = nvm version 2>&1
            if ($nvmVersionOutput -match "error|cannot find|settings\.txt") {
                Write-Log "NVM configuration issue detected, attempting repair..." "WARN"
                Repair-NVMSettings
            }
        }
        catch {
            Write-Log "Warning: NVM version check failed, attempting repair..." "WARN"
            Repair-NVMSettings
        }
        
        $nvmListOutput = ""
        try {
            $nvmListOutput = nvm list 2>&1 | Out-String
            Write-Log "NVM List Output: $nvmListOutput"
        }
        catch {
            Write-Log "Warning: Could not get NVM list, proceeding with installation" "WARN"
        }
        
        $nodeAlreadyInstalled = $nvmListOutput -match "18\.20\.4"
        
        if (-not $nodeAlreadyInstalled) {
            Write-Log "Installing Node.js 18.20.4..."
            $installOutput = nvm install 18.20.4 2>&1
            Write-Log "NVM Install Output: $installOutput"
            
            if ($installOutput -match "error|failed|cannot|unable|settings\.txt") {
                throw "Node.js 18.20.4 installation failed: $installOutput"
            }
            
            Start-Sleep -Seconds 5
        }
        else {
            Write-Log "Node.js 18.20.4 already installed"
        }
        
        Write-Log "Enabling NVM and switching to Node.js 18.20.4"
        $nvmOnOutput = nvm on 2>&1
        Write-Log "NVM On Output: $nvmOnOutput"
        
        $nvmUseOutput = nvm use 18.20.4 2>&1
        Write-Log "NVM Use Output: $nvmUseOutput"
        
        if ($nvmUseOutput -match "error|failed|cannot|unable|not found|settings\.txt") {
            throw "Failed to activate Node.js 18.20.4: $nvmUseOutput"
        }
        
        Start-Sleep -Seconds 3
        
        $nodePaths = @(
            "C:\Program Files\nodejs",
            "$env:APPDATA\nvm\nodejs"
        )
        
        foreach ($nodePath in $nodePaths) {
            if (Test-Path "$nodePath\node.exe") {
                Add-ToPathPermanently -Path $nodePath
                break
            }
        }
        
        $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
        
        $nodeFound = $false
        for ($i = 1; $i -le 5; $i++) {
            Start-Sleep -Seconds 2
            if (Get-Command node -ErrorAction SilentlyContinue) {
                $nodeFound = $true
                break
            }
            Write-Log "Waiting for Node.js to become available (attempt $i/5)..." "WARN"
        }
        
        if (-not $nodeFound) {
            throw "Node.js command not available after NVM activation"
        }
        
        $nodeVersion = node -v 2>&1
        if ($nodeVersion -notmatch "v18\.20\.4") {
            Write-Log "Warning: Expected Node v18.20.4 but got: $nodeVersion" "WARN"
        }
        
        Write-Log "Node.js activated successfully: $nodeVersion" "SUCCESS"
    }
    catch {
        throw "Node.js setup failed: $($_.Exception.Message)"
    }
}

function Install-Yarn {
    Write-Log "Installing Yarn 1.x"
    
    try {
        $existingYarnVersion = yarn -v 2>&1
        if ($existingYarnVersion -match '^1\.') {
            Write-Log "Yarn 1.x already installed: $existingYarnVersion" "SUCCESS"
            return
        }
    }
    catch { }
    
    $yarnInstalled = $false
    
    try {
        corepack enable | Out-Null
        corepack prepare yarn@1.22.22 --activate | Out-Null
        Start-Sleep -Seconds 2
        $yarnVersion = yarn -v 2>&1
        if ($yarnVersion -match '^1\.') {
            Write-Log "Yarn installed via corepack: $yarnVersion" "SUCCESS"
            $yarnInstalled = $true
        }
    }
    catch {
        Write-Log "Corepack method failed: $($_.Exception.Message)" "WARN"
    }
    
    if (-not $yarnInstalled) {
        try {
            Invoke-WithRetry -Operation "Yarn installation via npm" -ScriptBlock {
                npm install -g yarn@1.22.22 | Out-Null
            }
            
            Start-Sleep -Seconds 2
            $yarnVersion = yarn -v 2>&1
            if ($yarnVersion -match '^1\.') {
                Write-Log "Yarn installed via npm: $yarnVersion" "SUCCESS"
                $yarnInstalled = $true
            }
        }
        catch {
            Write-Log "NPM installation method failed: $($_.Exception.Message)" "WARN"
        }
    }
    
    if (-not $yarnInstalled) {
        throw "Failed to install Yarn 1.x"
    }
}

function Set-NodeGyp {
    Write-Log "Configuring node-gyp for Visual Studio 2022"
    
    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    $vsPath = $null
    
    if (Test-Path $vswhere) {
        try {
            $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
            if (-not $vsPath) {
                $vsPath = & $vswhere -latest -products * -property installationPath 2>$null
            }
        }
        catch { }
    }
    
    if (-not $vsPath) {
        $vsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools"
    }
    
    Write-Log "Using Visual Studio at: $vsPath"
    
    # Set basic node-gyp variables
    $env:npm_config_msvs_version = "2022"
    $env:GYP_MSVS_VERSION = "2022"
    $env:GYP_MSVS_OVERRIDE_PATH = $vsPath
    
    [Environment]::SetEnvironmentVariable("npm_config_msvs_version", "2022", "Machine")
    [Environment]::SetEnvironmentVariable("GYP_MSVS_VERSION", "2022", "Machine")
    [Environment]::SetEnvironmentVariable("GYP_MSVS_OVERRIDE_PATH", $vsPath, "Machine")
    
    # Add VS paths
    $pathsToAdd = @(
        "$vsPath\MSBuild\Current\Bin",
        "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\MSBuild\Current\Bin",
        "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin"
    )
    
    foreach ($path in $pathsToAdd) {
        if (Test-Path $path) {
            Add-ToPathPermanently -Path $path
        }
    }
    
    # Create simple .npmrc in user directory
    $userNpmrc = "$env:USERPROFILE\.npmrc"
    $npmrcContent = "msvs_version=2022"
    $npmrcContent | Out-File -FilePath $userNpmrc -Encoding ASCII -Force
    Write-Log "Created .npmrc at: $userNpmrc"
    
    Write-Log "node-gyp configuration completed" "SUCCESS"
}

function Update-Repository {
    Write-Log "Setting up repository"
    
    try {
        New-Item -ItemType Directory -Force -Path $Directory | Out-Null
    }
    catch {
        throw "Failed to create directory $Directory`: $($_.Exception.Message)"
    }
    
    $repoName = [IO.Path]::GetFileNameWithoutExtension((Split-Path -Leaf $RepoUrl))
    $repoPath = Join-Path $Directory $repoName
    
    if (-not (Test-Path (Join-Path $repoPath ".git"))) {
        Write-Log "Cloning $RepoUrl to $repoPath (branch $Branch)"
        git clone -b $Branch $RepoUrl $repoPath
        if ($LASTEXITCODE -ne 0) {
            throw "Git clone failed with exit code $LASTEXITCODE"
        }
    }
    else {
        Write-Log "Repository exists, updating..."
        
        git -C $repoPath fetch origin
        if ($LASTEXITCODE -ne 0) {
            throw "Git fetch failed with exit code $LASTEXITCODE"
        }
        
        $remoteBranches = git -C $repoPath branch -r 2>&1
        if ($remoteBranches -notmatch "origin/$Branch") {
            Write-Log "Branch $Branch not found on remote, using default branch" "WARN"
            $defaultBranchRef = git -C $repoPath symbolic-ref refs/remotes/origin/HEAD
            $Branch = $defaultBranchRef -replace 'refs/remotes/origin/', ''
        }
        
        git -C $repoPath checkout $Branch
        if ($LASTEXITCODE -ne 0) {
            throw "Git checkout failed with exit code $LASTEXITCODE"
        }
        
        git -C $repoPath pull --ff-only
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Fast-forward pull failed, trying regular pull" "WARN"
            git -C $repoPath pull
            if ($LASTEXITCODE -ne 0) {
                throw "Git pull failed with exit code $LASTEXITCODE"
            }
        }
    }
    
    $gitmodulesPath = Join-Path $repoPath ".gitmodules"
    if (Test-Path $gitmodulesPath) {
        Write-Log "Updating submodules"
        git -C $repoPath submodule update --init --recursive
        if ($LASTEXITCODE -ne 0) {
            throw "Git submodule update failed with exit code $LASTEXITCODE"
        }
    }
    
    $npmrcPath = Join-Path $repoPath ".npmrc"
    if (-not (Test-Path $npmrcPath)) {
        "msvs_version=2022" | Out-File -FilePath $npmrcPath -Encoding ASCII -Force
        Write-Log "Created .npmrc with msvs_version=2022" "SUCCESS"
    }
    
    Write-Log "Repository setup completed: $repoPath" "SUCCESS"
}

function Show-VersionInfo {
    Write-Log "Installed versions:"
    
    $tools = @{
        "Python" = { & py -3.10 -V 2>&1 }
        "Python (fallback)" = { python --version 2>&1 }
        "CMake" = { (cmake --version | Select-Object -First 1) 2>&1 }
        "Node.js" = { node -v 2>&1 }
        "NPM" = { npm -v 2>&1 }
        "Yarn" = { yarn -v 2>&1 }
        "Git" = { git --version 2>&1 }
        "NVM" = { nvm version 2>&1 }
    }
    
    foreach ($tool in $tools.GetEnumerator()) {
        try {
            $version = & $tool.Value
            if ($LASTEXITCODE -eq 0 -or $version) {
                Write-Host "  $($tool.Key): $version" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "  $($tool.Key): Not available" -ForegroundColor Yellow
        }
    }


}


# Main execution
try {
    Write-Log "Starting Windows development environment bootstrap (NVM only)"
    
    Test-WingetAvailable
    
    if (-not (Test-AdminRights)) {
        throw "Administrator rights required. Please run PowerShell as Administrator."
    }
    
    Write-Log "Installing development dependencies..."
    
    Install-Git
    Install-Python310
    Install-CMake
    Install-VisualStudioBuildTools
    Install-NVMAndNode
    Install-Yarn
    Set-NodeGyp
    
    Write-Log "All dependencies installed successfully" "SUCCESS"
    
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    
    $commonPaths = @(
        "C:\Program Files\nvm",
        "C:\Program Files\nodejs"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            if ($env:Path -notlike "*$path*") {
                $env:Path = "$path;$env:Path"
            }
        }
    }
    
    Show-VersionInfo
    
    Update-Repository
    
    Write-Log "Bootstrap completed successfully!" "SUCCESS"
    Write-Log "You can now run 'yarn install' in the project directory to install dependencies."
    
}
catch {
    Write-Log "Bootstrap failed: $($_.Exception.Message)" "ERROR"
    Write-Log "Stack trace: $($_.ScriptStackTrace)" "ERROR"
    
    Write-Log "Troubleshooting information:" "WARN"
    Write-Log "1. Try running the script again - some installations may need a second attempt" "WARN"
    Write-Log "2. If NVM issues persist, try manually reinstalling NVM for Windows" "WARN"
    Write-Log "3. Ensure you're running PowerShell as Administrator" "WARN"
    Write-Log "4. Check that Windows Defender isn't blocking the installations" "WARN"
    Write-Log "5. For node-gyp issues, try: npm config set msvs_version 2022" "WARN"
    
    exit 1
}