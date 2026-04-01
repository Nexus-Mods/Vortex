// @ts-check
/** @type {import('electron-builder').Configuration} */
const config = {
  $schema:
    "https://github.com/electron-userland/electron-builder/raw/refs/tags/v24.13.3/packages/app-builder-lib/scheme.json",
  appId: "com.nexusmods.vortex",
  includeSubNodeModules: false,
  directories: {
    buildResources: "./nsis",
    app: "./dist",
    output: "../../dist",
  },
  win: {
    target: "nsis",
    icon: "nsis/icon.ico",
    publish: [
      {
        provider: "github",
        owner: "Nexus-Mods",
        repo: "Vortex",
        private: false,
      },
    ],
    publisherName: ["Black Tree Gaming Limited", "Black Tree Gaming Ltd"],
    signingHashAlgorithms: ["sha256"],
    rfc3161TimeStampServer: "http://timestamp.comodoca.com/rfc3161",
    timeStampServer: "http://timestamp.comodoca.com",
    extraResources: [
      "./build/VC_redist.x64.exe",
      "./build/windowsdesktop-runtime-win-x64.exe",
    ],
  },
  nsis: {
    perMachine: true,
    runAfterFinish: true,
    menuCategory: false,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    uninstallDisplayName: "${productName}",
    include: "./nsis/installer.nsh",
    artifactName: "vortex-setup-${version}.${ext}",
    installerIcon: "nsis/icon.ico",
    installerHeaderIcon: "nsis/icon.ico",
  },
  linux: {
    target: ["AppImage", "deb"],
    artifactName: "vortex-setup-${version}.${ext}",
    icon: "../../assets/images/vortex.png",
    category: "Network;Development;Game;",
    synopsis: "Mod Manager",
    description:
      "The elegant, powerful, and open-source mod manager from Nexus Mods.",
    maintainer:
      "Black Tree Gaming Ltd. <support@nexusmods.com> (https://www.nexusmods.com/)",
    mimeTypes: ["x-scheme-handler/nxm"],
    publish: [
      {
        provider: "github",
        owner: "Nexus-Mods",
        repo: "Vortex",
        private: false,
      },
    ],
  },
  deb: {
    depends: ["xdg-utils", "libasound2"],
  },
  extraResources: [
    "./nsis/**/*",
    {
      from: "../../locales",
      to: "locales",
    },
  ],
  // On Linux, winapi-bindings is replaced at bundle time by a JS shim.
  // The native .node binary is not needed at runtime and causes an EEXIST
  // conflict when electron-builder's asarUnpack "**/*.node" and its native
  // module handler both try to process the same file.
  files:
    process.platform === "linux"
      ? ["**/*", "!**/winapi-bindings/**"]
      : ["**/*"],
  asar: true,
  asarUnpack: [
    "LICENSE.md",
    "bundledPlugins",
    "node_modules/7z-bin",
    "node_modules/bootstrap-sass/assets/stylesheets",
    "node_modules/react-select/scss",
    "node_modules/@nexusmods/fomod-installer-native/dist/*.dll",
    "node_modules/@nexusmods/fomod-installer-ipc/dist/*.exe",
    "assets/*.exe",
    "node_modules/@nexusmods/fomod-installer-native/prebuilds/linux-x64/ModInstaller.Native.so",
    "node_modules/@nexusmods/fomod-installer-ipc/dist/ModInstallerIPC",
    "assets/dotnetprobe",
    "assets/css/**",
    "**/*.node",
  ],
  buildDependenciesFromSource: false,
  npmRebuild: false,
};

module.exports = config;
