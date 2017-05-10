import { ISavegame } from '../types/ISavegame';

import { Dimensions } from 'gamebryo-savegame';
import * as React from 'react';

interface ICanvasProps {
  save: ISavegame;
}

// current typings know neither the function nor the return value
declare const createImageBitmap: (imgData: ImageData) => Promise<any>;

class ScreenshotCanvas extends React.Component<ICanvasProps, {}> {
  private screenshotCanvas: HTMLCanvasElement;

  public componentDidMount() {
    const ctx: CanvasRenderingContext2D = this.screenshotCanvas.getContext('2d');
    const imgData: ImageData = ctx.createImageData(
      this.screenshotCanvas.width, this.screenshotCanvas.height);

    this.props.save.savegameBind.screenshot(imgData.data);
    createImageBitmap(imgData)
      .then((bitmap) => {
        ctx.drawImage(bitmap, 0, 0);
      });
  }

  public render(): JSX.Element {
    const { save } = this.props;
    if (save === undefined) {
      return null;
    }
    const dim: Dimensions = (save.attributes as any).screenshot;
    return (
      <canvas
        id='screenshot-canvas'
        ref={this.refCanvas}
        width={dim.width}
        height={dim.height}
        style={{ width: '100%' }}
      />);
  }

  private refCanvas = (ref) => {
    this.screenshotCanvas = ref;
  }
}

export default ScreenshotCanvas;
