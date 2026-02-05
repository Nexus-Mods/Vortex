{
  description = "Vortex development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js and package manager
            nodejs_22
            yarn

            # Flatpak tooling
            flatpak
            flatpak-builder
            appstream

            # Python with setuptools for node-gyp (distutils removed in Python 3.12+)
            (python3.withPackages (ps: [ ps.setuptools ]))

            # Build tools
            gnumake
            pkg-config

            # C/C++ toolchain
            clang
            llvmPackages.libcxx

            # Electron (wrapped with GTK dependencies)
            electron_39 # 14 Dec 2025: We're ahead of Vortex which is on 37. Doing this for default Wayland support.

            # GTK dependencies for Electron runtime
            gtk3
            gtk4
            glib
            gsettings-desktop-schemas
            dconf
            librsvg
          ];

          env = {
            # Compiler settings for node-gyp
            CC = "${pkgs.clang}/bin/clang";
            CXX = "${pkgs.clang}/bin/clang++";

            # Ignore strict node engine version checks
            YARN_IGNORE_ENGINES = "true";

            # Prevent yarn from downloading Electron binaries
            ELECTRON_SKIP_BINARY_DOWNLOAD = "1";

            # Point to Nix-provided Electron
            ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron_39}/libexec/electron";
          };

          # Set up GTK environment (mimics wrapGAppsHook3)
          shellHook = ''
            # GSettings schemas
            export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:${pkgs.gtk4}/share/gsettings-schemas/${pkgs.gtk4.name}:${pkgs.glib}/share:$XDG_DATA_DIRS"

            # GIO modules (for dconf)
            export GIO_EXTRA_MODULES="${pkgs.dconf.lib}/lib/gio/modules"

            # GDK pixbuf loaders (for image loading)
            export GDK_PIXBUF_MODULE_FILE="${pkgs.librsvg}/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache"

            # Chromium sandbox
            export CHROME_DEVEL_SANDBOX="${pkgs.electron_37}/libexec/electron/chrome-sandbox"

            # Register protocol handler
            ./scripts/linux-protocol-registration.sh
          '';
        };
      });
}
