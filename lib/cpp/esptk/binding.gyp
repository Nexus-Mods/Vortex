{
	"targets": [
		{
			"target_name": "esptk",
			"includes": [
				"auto.gypi"
			],
			"sources": [
                "esptk/src/espfile.cpp",
                "esptk/src/record.cpp",
                "esptk/src/subrecord.cpp",
				"index.cpp"
			]
		}
	],
	"includes": [
		"auto-top.gypi"
	]
}
