!macro customInstall
  SetRegView 64

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