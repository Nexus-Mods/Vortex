#!/usr/bin/env bash

# http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
IFS=$'\n\t'

current_dir="$(dirname -- "$(readlink -f -- "$0";)";)"
project_dir="$(dirname "${current_dir}")"
electron_executable="${project_dir}/node_modules/electron/dist/electron"
if ! [ -f "${electron_executable}" ]; then
  electron_executable="$(which electron)"
fi
exec_path="${electron_executable} ${project_dir}"

echo "Project: $project_dir"
echo "Electron: $electron_executable"

template_file="${current_dir}/com.nexusmods.vortex.desktop.in"
output_directory="$HOME/.local/share/applications"
output_file="${output_directory}/com.nexusmods.vortex.desktop"

echo "Writing .desktop file to ${output_file}"
sed -e "s|@EXEC_PATH@|${exec_path}|g" "${template_file}" > "${output_file}"

echo "Updating desktop database"
if ! [ -x "$(command -v update-desktop-database)" ]; then
  echo "Error: 'update-desktop-database' is not installed" >&2
  exit 1
fi

update-desktop-database "${output_directory}"

echo "Registering protocol handler"
if ! [ -x "$(command -v xdg-settings)" ]; then
  echo "Error: 'xdg-settings' is not installed" >&2
  exit 1
fi

xdg-settings set default-url-scheme-handler "nxm" "com.nexusmods.vortex.desktop"

echo "Verification:"
xdg-settings get default-url-scheme-handler "nxm"

echo "Done"
