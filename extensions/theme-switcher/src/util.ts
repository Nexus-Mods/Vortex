import * as path from "path";
import { util } from "vortex-api";

export function themesPath(): string {
  return path.join(util.getVortexPath("userData"), "themes");
}

interface IFont {
  family: string;
}

const getAvailableFontImpl = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fontScanner = require("font-scanner");
  return fontScanner
    .getAvailableFonts()
    .then((fonts: IFont[]) =>
      Array.from(
        new Set<string>([
          "Inter",
          "Roboto",
          "Montserrat",
          "BebasNeue",
          ...(fonts || []).map((font) => font.family).sort(),
        ]),
      ),
    );
};

const getAvailableFonts: () => Promise<string[]> = util.makeRemoteCall(
  "get-available-fonts",
  getAvailableFontImpl,
);

export { getAvailableFonts };
