{
  "variables": {
    "NAPI_VERSION": "8"
  },
  "target_defaults": {
    "default_configuration": "Release",
    "configurations": {
      "Release": {
        "defines": [
          "NODE_ADDON_API_ENABLE_MAYBE",
          "NODE_ADDON_API_DISABLE_DEPRECATED",
          "NAPI_CPP_EXCEPTIONS",
          "NAPI_VERSION=<(NAPI_VERSION)"
        ],
        "cflags!": [
          "-fno-exceptions"
        ],
        "cflags_cc!": [
          "-fno-exceptions"
        ],
        "cflags_cc": [
          "-fexceptions",
          "-std=c++17"
        ],
        "xcode_settings": {
          "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
          "CLANG_CXX_LIBRARY": "libc++",
          "MACOSX_DEPLOYMENT_TARGET": "10.15",
          "OTHER_CPLUSPLUSFLAGS": [
            "-fexceptions",
            "-std=c++17"
          ]
        },
        "msvs_settings": {
          "VCCLCompilerTool": {
            "ExceptionHandling": 1
          }
        }
      }
    }
  }
}