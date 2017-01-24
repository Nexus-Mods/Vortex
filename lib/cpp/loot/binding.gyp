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
            ],
            'cflags!': ['-fno-exceptions'],
            'cflags_cc!': ['-fno-exceptions'],
            'conditions': [
                ['OS=="win"', {
                    'defines!': [
                        '_HAS_EXCEPTIONS=0'
                    ],
                    'msvs_settings': {
                        'VCCLCompilerTool': {
                            'ExceptionHandling': 1,
                        }
                    }
                }],
                ['OS=="mac"', {
                    'xcode_settings': {
                        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
                    }
                }]
            ]
        }
    ],
    "includes": [
        "auto-top.gypi"
    ]
}
