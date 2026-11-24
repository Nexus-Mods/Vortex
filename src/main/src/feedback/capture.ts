import type { IFeedbackScreenshot } from "@vortex/shared/ipc";
import type { NativeImage } from "electron";

/** A window wider or taller than this is scaled down, which keeps the image a few hundred KB. */
export const MAX_SCREENSHOT_SIDE = 1920;

/** High enough that the text of a mod list stays readable. */
const JPEG_QUALITY = 80;

/** The part of `WebContents` a capture needs. */
export interface ICapturable {
  capturePage(): Promise<NativeImage>;
}

/** A JPEG of the page, scaled so its longer side is at most `MAX_SCREENSHOT_SIDE`. */
export async function captureAsJpeg(target: ICapturable): Promise<IFeedbackScreenshot | null> {
  let image = await target.capturePage();
  if (image.isEmpty()) {
    return null;
  }

  const { width, height } = image.getSize();
  if (Math.max(width, height) > MAX_SCREENSHOT_SIDE) {
    image =
      width >= height
        ? image.resize({ width: MAX_SCREENSHOT_SIDE, quality: "good" })
        : image.resize({ height: MAX_SCREENSHOT_SIDE, quality: "good" });
  }

  const size = image.getSize();
  return {
    mime: "image/jpeg",
    width: size.width,
    height: size.height,
    data: image.toJPEG(JPEG_QUALITY).toString("base64"),
  };
}
