{
    "targets": [
        {
            "target_name": "GamebryoSave",
            "includes": [
                "auto.gypi"
            ],
            "sources": [
                "src/gamebryosavegame.cpp",
                "src/fmt/format.cc"
            ],
            "include_dirs": [
                "./lz4/include"
            ],
            "libraries": [
                "-l../lz4/dll/liblz4"
            ]
        }
    ],
    "includes": [
        "auto-top.gypi"
    ]
}
