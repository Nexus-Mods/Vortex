{
    "targets": [
        {
            "target_name": "turbowalk",
            "includes": [
                "auto.gypi"
            ],
            "sources": [
                "src/UnicodeString.cpp",
                "src/walk.cpp",
                "src/walkwrapper.cpp"
            ],
            "include_dirs": [
              "<!(node -e \"require('nan')\")"
            ],
            "libraries": [
            ],
            "cflags!": ["-fno-exceptions"],
            "cflags_cc!": ["-fno-exceptions"],
            "conditions": [
                ["OS==\"win\"", {
                    "defines!": [
                        "_HAS_EXCEPTIONS=0",
                        "UNICODE",
                        "_UNICODE"
                    ],
                    "msvs_settings": {
                        "VCCLCompilerTool": {
                            "ExceptionHandling": 1
                        }
                    }
                }],
                ["OS==\"mac\"", {
                    "xcode_settings": {
                        "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
                    }
                }]
            ]
        }
    ],
    "includes": [
        "auto-top.gypi"
    ]
}
