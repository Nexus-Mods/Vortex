{
    "targets": [
        {
            "target_name": "loot",
            "includes": [
                "auto.gypi"
            ],
            "sources": [
                "src/lootwrapper.cpp"
            ],
            "include_dirs": [
                "./loot/include"
            ],
            "libraries": [
                "-l../loot/loot_api"
            ]
        }
    ],
    "includes": [
        "auto-top.gypi"
    ],
    'configurations': {
        'Release': {
            'msvs_settings': {
                'VCCLCompilerTool': {
                    'ExceptionHandling': 1,
                }
            }
        }
    },
}
