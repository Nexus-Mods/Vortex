import type { NativeImage } from "electron";
import { describe, expect, it, vi } from "vitest";

import { captureAsJpeg } from "./capture";

interface IFakeImage {
  isEmpty: () => boolean;
  getSize: () => { width: number; height: number };
  resize: (options: { width?: number; height?: number }) => IFakeImage;
  toJPEG: (quality: number) => Buffer;
}

const fakeImage = (width: number, height: number, resize = vi.fn()): IFakeImage => ({
  isEmpty: () => width === 0 || height === 0,
  getSize: () => ({ width, height }),
  resize: (options) => {
    resize(options);
    const scale =
      options.width !== undefined ? options.width / width : (options.height ?? height) / height;
    return fakeImage(Math.round(width * scale), Math.round(height * scale), resize);
  },
  toJPEG: () => Buffer.from("jpeg"),
});

const target = (image: IFakeImage) => ({
  capturePage: () => Promise.resolve(image as unknown as NativeImage),
});

describe("captureAsJpeg", () => {
  it("returns the page as base64 JPEG with its size", async () => {
    const resize = vi.fn();

    const capture = await captureAsJpeg(target(fakeImage(1280, 720, resize)));

    expect(capture).toEqual({
      mime: "image/jpeg",
      width: 1280,
      height: 720,
      data: Buffer.from("jpeg").toString("base64"),
    });
    expect(resize).not.toHaveBeenCalled();
  });

  it("scales a wide window down to 1920 across", async () => {
    const capture = await captureAsJpeg(target(fakeImage(3840, 2160)));

    expect(capture).toMatchObject({ width: 1920, height: 1080 });
  });

  it("scales a tall window down to 1920 high", async () => {
    const capture = await captureAsJpeg(target(fakeImage(1440, 2560)));

    expect(capture).toMatchObject({ width: 1080, height: 1920 });
  });

  it("returns null for an empty capture", async () => {
    expect(await captureAsJpeg(target(fakeImage(0, 0)))).toBeNull();
  });
});
