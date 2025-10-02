#!/usr/bin/env bash
set -euo pipefail

# Prepare environment to build bsdiff-node on macOS/ARM by enabling
# C++ exceptions and defining NAPI_CPP_EXCEPTIONS during node-gyp builds.
#
# Usage:
#   bash scripts/prepare-collections-install.sh [extensions/collections]
#
# If no path is provided, defaults to extensions/collections.

TARGET_DIR="${1:-extensions/collections}"

if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: Target directory '$TARGET_DIR' does not exist." >&2
  exit 1
fi

echo "Preparing native build flags for '$TARGET_DIR' (enable NAPI C++ exceptions)"

# Ensure clang++ is used and exceptions/macros are enabled
export CXX="${CXX:-clang++}"
export CC="${CC:-clang}"
export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-10.15}"

# Preprocessor and compiler flags so node-addon-api detects exception support
export CPPFLAGS="${CPPFLAGS:-} -DNAPI_CPP_EXCEPTIONS"
export CXXFLAGS="${CXXFLAGS:-} -DNAPI_CPP_EXCEPTIONS -std=c++17 -fexceptions"

# Help gyp pick up the macro and avoid disabling exceptions
export GYP_DEFINES="${GYP_DEFINES:-} NAPI_CPP_EXCEPTIONS=1"

# Avoid attempting from-source builds for other modules when prebuilt binaries exist
export npm_config_build_from_source="false"

echo "Environment prepared for install in '$TARGET_DIR'."