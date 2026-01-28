import { ISavegame } from "../types/ISavegame";

import { Dimensions } from "gamebryo-savegame";
import * as React from "react";
import { log } from "vortex-api";
import { getScreenshot } from "../util/refreshSavegames";

interface ICanvasProps {
  save: ISavegame;
}

// current typings know neither the function nor the return value
declare const createImageBitmap: (imgData: ImageData) => Promise<any>;

class ScreenshotCanvas extends React.Component<ICanvasProps, {}> {
  private screenshotCanvas: HTMLCanvasElement = null;

  public componentDidMount() {
    this.updateImage();
  }

  public UNSAFE_componentWillReceiveProps(newProps: ICanvasProps) {
    if (this.props.save !== newProps.save) {
      this.updateImage();
    }
  }

  public render(): JSX.Element {
    const { save } = this.props;
    if (save === undefined || save.attributes["screenshot"] === undefined) {
      return null;
    }
    const dim: Dimensions = (save.attributes as any).screenshot;
    return (
      <canvas
        className="screenshot-canvas"
        ref={this.refCanvas}
        width={dim.width}
        height={dim.height}
      />
    );
  }

  private refCanvas = (ref) => {
    this.screenshotCanvas = ref;
  };

  private updateImage() {
    const { save } = this.props;
    if (this.screenshotCanvas === null) {
      return;
    }
    const ctx: CanvasRenderingContext2D =
      this.screenshotCanvas.getContext("2d");
    const width = Math.max(this.screenshotCanvas.width, 1);
    const height = Math.max(this.screenshotCanvas.height, 1);
    const buffer: Uint8ClampedArray = getScreenshot(save.id);
    if (buffer === undefined) {
      return;
    }
    // this is supposed to work but it crashes the process - maybe a bug in the chrome
    // version bundled with electron 2.0.16?
    // const imgData: ImageData = new ImageData(buffer, width, height);
    const imgData: ImageData = ctx.createImageData(width, height);
    imgData.data.set(buffer);

    createImageBitmap(imgData)
      .then((bitmap) => {
        ctx.drawImage(bitmap, 0, 0);
      })
      .catch((err) => {
        log("warn", "failed to read savegame screenshot", {
          fileName: save.filePath,
          error: err.message,
        });
      });
  }
}

export default ScreenshotCanvas;
