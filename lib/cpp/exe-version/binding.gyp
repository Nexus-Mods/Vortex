{
    "targets": [
        {
            "target_name": "ExeVersion",
            "includes": [
                "auto.gypi"
            ],
            "include-dirs": [
                "test",
                "<!(node -e \"require('nan')\")"
            ],
            "sources": [
                "src/exever_win.cpp"
            ],
            "libraries": [
                "-lVersion"
            ],
            'defines!': [
                '_HAS_EXCEPTIONS=0'
            ],
            'msvs_settings': {
                'VCCLCompilerTool': {
                    'ExceptionHandling': 1,
                }
            }
        }
    ]
}
