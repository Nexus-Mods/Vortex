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
  SetOutPath "$TEMP"
  File "D:\\a\\Vortex\\Vortex\\dist\\win-unpacked\\resources\\build\\windowsdesktop-runtime-9.0.6-win-x64.exe"
  File "D:\\a\\Vortex\\Vortex\\dist\\win-unpacked\\resources\\build\\VC_redist.x64.exe"
  ExecWait '"$TEMP\\VC_redist.x64.exe" /quiet /norestart'
  ExecWait '"$TEMP\\windowsdesktop-runtime-9.0.6-win-x64.exe" /install /quiet /norestart'
!macroend

!macro customUnInstall
  # if we are updating (i.e. auto uninstall before an install), don't ask for feedback
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO "Thank you for using Vortex. Would you like to help us improve Vortex by giving us feedback?" IDNO no  
      ExecShell open "https://forms.gle/EAxrcY6C1MYq9d1e9" "" SW_SHOWNORMAL
    no:
  ${endIf}
!macroend