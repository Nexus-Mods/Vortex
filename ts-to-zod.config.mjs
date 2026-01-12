/**
 * @type {import("ts-to-zod").TsToZodConfig}
 **/
const config = [
  {
    name: "IPreset",
    input: "./src/types/IPreset.ts",
    output: "./src/types/IPreset.gen.ts",
  },
];

export default config;
