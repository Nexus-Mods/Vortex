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
        "src/IconExtractor.cpp",
        "src/IconExtractorWindows.cpp"
      ],
      "libraries": [
        "-lGdiplus"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      "cflags": [
        "-EHsc"
      ]
    }
  ]
}
