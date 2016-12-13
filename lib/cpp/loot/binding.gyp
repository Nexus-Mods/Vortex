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
                "./loot_api/include"
            ],
            "libraries": [
                "-l../loot_api/loot_api"
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
