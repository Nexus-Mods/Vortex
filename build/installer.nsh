!include WinVer.nsh
 
!macro preInit
  ${IfNot} ${AtLeastWin10}

    MessageBox MB_ABORTRETRYIGNORE  "Vortex 1.8 and above is not compatible with your operating system.$\r$\n\
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
  SetRegView 64

  ReadRegDWORD $1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"

  ${DisableX64FSRedirection}
  IfFileExists "$SYSDIR\vcruntime140.dll" 0 Missing
  IfFileExists "$SYSDIR\vcruntime140_1.dll" Present Missing

  Missing:
  StrCpy $1 "0"

  Present:
  ${EnableX64FSRedirection}

  ${If} $1 != "1"
    File /oname=$PLUGINSDIR\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
    ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /passive /norestart'
  ${EndIf}

  ; Native FOMOD installer
  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\fomod-installer-native\dist" "(S-1-15-2-1)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for fomod-installer-native (S-1-15-2-1): $R0"
  ${EndIf}

  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\fomod-installer-native\dist" "(S-1-15-2-2)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for fomod-installer-native (S-1-15-2-2): $R0"
  ${EndIf}

  ; IPC FOMOD installer
  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\fomod-installer-ipc\dist" "(S-1-15-2-1)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for fomod-installer-ipc (S-1-15-2-1): $R0"
  ${EndIf}

  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\fomod-installer-ipc\dist" "(S-1-15-2-2)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    DetailPrint "Warning: Could not grant permissions for fomod-installer-ipc (S-1-15-2-2): $R0"
  ${EndIf}

  ; Add Windows Defender exclusion for Vortex installation folder (silent)
  nsExec::ExecToLog 'powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { Add-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue } catch { }"'

!macroend

!macro customUnInstall
  ; Remove Windows Defender exclusion for Vortex installation folder (silent)
  nsExec::ExecToLog 'powershell -WindowStyle Hidden -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "try { Remove-MpPreference -ExclusionPath \"$INSTDIR\" -ErrorAction SilentlyContinue } catch { }"'

  # if we are updating (i.e. auto uninstall before an install), don't ask for feedback
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO "Thank you for using Vortex. Would you like to help us improve Vortex by giving us feedback?" IDNO no  
      ExecShell open "https://forms.gle/EAxrcY6C1MYq9d1e9" "" SW_SHOWNORMAL
    no:
  ${endIf}
!macroend