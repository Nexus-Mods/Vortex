!include WinVer.nsh
!addplugindir "${BUILD_RESOURCES_DIR}\plugins\amd64-unicode"
!addplugindir "${BUILD_RESOURCES_DIR}\plugins\x86-ansi"
!addplugindir "${BUILD_RESOURCES_DIR}\plugins\x86-unicode"
!macro preInit
  ${IfNot} ${AtLeastWin10}

    MessageBox MB_ABORTRETRYIGNORE  "mkeiitmods is not compatible with your operating system.$\r$\n\
    Windows 10 or newer is required to run correctly.$\r$\n\
    Click $\"Retry$\" for troubleshooting steps (opens in browser).$\r$\n\
    Click $\"Ignore$\" to continue anyway." IDRETRY exit IDIGNORE ignore
  Quit
exit:
  ExecShell open "https://forums.nexusmods.com/index.php?/topic/12870396-windows-7881-vortex-will-not-start-up/"
  Quit
ignore:
  Nop

  ${EndIf}
!macroend

!macro customInstall
  SetOutPath "$TEMP"
  File "${PROJECT_DIR}\temp\VC_redist.x64.exe"
  File "${PROJECT_DIR}\temp\windowsdesktop-runtime-win-x64.exe"
  ExecWait '"$TEMP\\VC_redist.x64.exe" /quiet /norestart'
  ExecWait '"$TEMP\\windowsdesktop-runtime-win-x64.exe" /install /quiet /norestart'

  ; Grant permissions to FOMOD installer directories for AppContainer sandboxing
  ; SIDs: (S-1-15-2-1) = ALL_APP_PACKAGES, (S-1-15-2-2) = ALL_RESTRICTED_APP_PACKAGES

  ; Native FOMOD installer
  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\@nexusmods\fomod-installer-native\dist" "(S-1-15-2-1)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for @nexusmods/fomod-installer-native (S-1-15-2-1): $R0"
  ${EndIf}

  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\@nexusmods\fomod-installer-native\dist" "(S-1-15-2-2)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for @nexusmods/fomod-installer-native (S-1-15-2-2): $R0"
  ${EndIf}

  ; IPC FOMOD installer
  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\@nexusmods\fomod-installer-ipc\dist" "(S-1-15-2-1)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for @nexusmods/fomod-installer-ipc (S-1-15-2-1): $R0"
  ${EndIf}

  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\@nexusmods\fomod-installer-ipc\dist" "(S-1-15-2-2)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for @nexusmods/fomod-installer-ipc (S-1-15-2-2): $R0"
  ${EndIf}

  ; Add Windows Defender exclusion for the installation folder (silent)
  nsExec::ExecToLog 'powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { Add-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue } catch { }"'
!macroend

!macro customUnInstall
  ; Remove Windows Defender exclusion for the installation folder (silent)
  nsExec::ExecToLog 'powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { Remove-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue } catch { }"'

  ; mkeiitmods: Vortex asks for feedback here through a Nexus Mods form; we don't
!macroend
