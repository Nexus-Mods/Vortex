{
    "targets": [
        {
            "target_name": "ba2tk",
            "includes": [
                "auto.gypi"
            ],
            "sources": [
                "ba2tk/src/ba2archive.cpp",
                "ba2tk/src/ba2exception.cpp",
                "index.cpp"
            ],
            "include_dirs": [
                "./ba2tk/src/common",
                "./zlib/include"
            ],
            "cflags!": ["-fno-exceptions"],
            "cflags_cc!": ["-fno-exceptions"],
            "conditions": [
                [
                    'OS=="win"',
                    {
                        "defines!": [
                            "_HAS_EXCEPTIONS=0"
                        ],
                        "libraries": [
                            "-l../zlib/win32/zlibstatic.lib"
                        ],
                        "msvs_settings": {
                            "VCCLCompilerTool": {
                                "ExceptionHandling": 1
                            }
                        }
                    }
                ],
                [
                    'OS=="mac"',
                    {
                        "xcode_settings": {
                            "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
                        }
                    }
                ]
            ]
        }
    ],
    "includes": [
        "auto-top.gypi"
    ]
}
