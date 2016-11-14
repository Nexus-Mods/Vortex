{
  "targets": [
    {
      "target_name": "IconExtractor",
      "includes": [
        "auto.gypi"
      ],
      "include-dirs": [
        "test",
        "<!(node -e \"require('nan')\")"
      ],
      "sources": [
        "src/IconExtractor.cpp"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      "conditions": [
        ['OS=="win"', {
          'sources': [
	    "src/IconExtractorWindows.cpp"
          ],
          "libraries": [
            "-lGdiplus"
          ],
        }],
        ['OS=="linux"', {
          'sources': [
            "src/IconExtractorLinux.cpp"
          ],
          "cflags!": [ "-fno-exceptions" ],
          "cflags_cc!": [ "-fno-exceptions" ],
          "cflags": [
            "-fexceptions"
          ],
          "cflags_cc": [
            "-fexceptions"
          ]
        }],
        ['OS=="mac"', {
          'sources': [
	          "src/IconExtractorMacOSX.cpp"
          ],
          "cflags!": [ "-fno-exceptions" ],
          "cflags_cc!": [ "-fno-exceptions" ],
          "cflags": [
            "-fexceptions"
          ],
          "cflags_cc": [
            "-fexceptions"
          ],
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
          }
        }]
      ]
    }
  ]
}
