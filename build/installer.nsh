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

  ${If} ${AtLeastWin10}
#    MessageBox MB_OK "Windows 10 detected"
    Quit
  ${EndIf}

  ReadRegDWORD $1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ${If} $1 != "1"
    File /oname=$PLUGINSDIR\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
    ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /passive /norestart'
  ${EndIf}

  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\fomod-installer\dist" "(S-1-15-2-1)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    MessageBox MB_OK `AccessControl error: $R0`
  ${EndIf}

  AccessControl::GrantOnFile \
    "$INSTDIR\resources\app.asar.unpacked\node_modules\fomod-installer\dist" "(S-1-15-2-2)" "ListDirectory + GenericRead + GenericExecute"
  Pop $R0
  ${If} $R0 == error
    Pop $R0
    MessageBox MB_OK `AccessControl error: $R0`
  ${EndIf}

!macroend