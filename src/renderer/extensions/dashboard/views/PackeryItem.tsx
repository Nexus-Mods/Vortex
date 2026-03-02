import Icon from "../../../controls/Icon";
import { ComponentEx } from "../../../controls/ComponentEx";
import type { TFunction } from "../../../util/i18n";
import lazyRequire from "../../../util/lazyRequire";
import { log } from "../../../util/log";

import type * as DraggabillyT from "draggabilly";
import type * as PackeryT from "packery";
import type { ResizeDirection } from "re-resizable";
import { Resizable } from "re-resizable";
import * as React from "react";
import { Button } from "react-bootstrap";
import { getErrorMessageOrDefault } from "@vortex/shared";

const Draggabilly = lazyRequire<typeof DraggabillyT>(() => ({
  default: require("draggabilly"),
}));

export interface IPackeryItemProps {
  t: TFunction;
  id: string;
  width: number;
  height: number;
  totalWidth?: number;
  packery?: PackeryT.Packery;
  fixed: boolean;
  editable: boolean;
  closable: boolean;
  position: number;
  onDismiss?: (id: string) => void;
  onSetWidth?: (id: string, width: number) => void;
  onSetHeight?: (id: string, height: number) => void;
  onUpdateLayout?: () => void;
}

interface IPackeryItemState {
  context: {
    x: number;
    y: number;
  };
  size: {
    width: string;
    height: string;
  };
  resizing: boolean;
}

function clamp(input: number, min: number, max: number): number {
  return Math.min(Math.max(input, min), max);
}

function ResizeHandle(props: { corner: string }) {
  return (
    <div className={`resize-handle-${props.corner}`}>
      <Icon name="corner-handle" />
    </div>
  );
}

const emptyObject = {};
const FULL_SIZE = { width: "100%", height: "100%" };
const handleComponent = { bottomRight: <ResizeHandle corner="br" /> };

class PackeryItem extends ComponentEx<IPackeryItemProps, IPackeryItemState> {
  private mRef: HTMLElement = null;
  private mResizeRef: Resizable = null;
  private mPackeryItem: any;
  private mCellWidth: number = 10000;
  private mCellHeight: number = 10000;
  private mMinWidth: number = 0;
  private mMinHeight: number = 0;
  private mDrag: DraggabillyT.default = undefined;
  private mResizeAnchor: {
    x: number;
    y: number;
    width: number;
    height: number;
  } = { x: 0, y: 0, width: 0, height: 0 };
  private mResizeUp: boolean = false;
  private mResizeLeft: boolean = false;

  constructor(props: IPackeryItemProps) {
    super(props);

    this.initState({
      context: undefined,
      size: { width: "100%", height: "100%" },
      resizing: false,
    });
  }

  public UNSAFE_componentWillReceiveProps(
    newProps: React.PropsWithChildren<IPackeryItemProps>,
  ) {
    if (!newProps.fixed && newProps.packery !== this.props.packery) {
      this.mPackeryItem = undefined;
      this.makeDraggable(newProps);
    }
  }

  public render(): JSX.Element {
    const { closable, editable, height, id, totalWidth, width } = this.props;
    const { resizing } = this.state;

    if (this.props.packery === undefined) {
      return null;
    }

    // round to 2 positions after decimal point. It's fairly noticable if
    // widgets don't align even by a few pixels
    const widthPerc = Math.floor((width * 10000) / totalWidth) / 100;

    const classes = [`packery-height-${height}`];

    if (resizing) {
      classes.push("stamp");
    } else {
      classes.push("packery-item");
    }

    if (editable) {
      classes.push("packery-editmode");
    } else {
      classes.push("packery-viewmode");
    }

    return (
      <div
        id={id}
        ref={this.setRef}
        style={{ width: `${widthPerc}%` }}
        className={classes.join(" ")}
        onContextMenu={this.onContext}
      >
        <Resizable
          ref={this.setResizableRef}
          defaultSize={FULL_SIZE}
          minWidth={resizing ? this.mMinWidth / 2 : undefined}
          minHeight={resizing ? this.mMinHeight / 2 : undefined}
          maxWidth={resizing ? 3 * this.mCellWidth : undefined}
          maxHeight={resizing ? 6 * this.mCellHeight : undefined}
          onResizeStart={this.resizeStart}
          onResizeStop={this.resizeEnd}
          onResize={this.resizeCallback}
          enable={editable ? undefined : emptyObject}
          handleComponent={handleComponent}
        >
          {this.props.children}
          <div key="drag-handle" className="drag-handle" />
          <div className="packery-buttons">
            {editable && closable ? (
              <Button
                className="dashlet-close-button"
                onClick={this.dismissWidget}
              >
                <Icon name="close" />
              </Button>
            ) : null}
          </div>
        </Resizable>
      </div>
    );
  }

  public get packeryItem(): any {
    if (this.mPackeryItem === undefined) {
      this.mPackeryItem = this.props.packery.getItem(this.mRef);
    }
    return this.mPackeryItem;
  }

  private setResizableRef = (x) => {
    this.mResizeRef = x;
  };

  private resizeStart = (
    e: React.MouseEvent<HTMLElement>,
    dir: ResizeDirection,
  ) => {
    try {
      this.packeryItem.enablePlacing();
      this.nextState.resizing = true;
      this.props.packery.stamp(this.mRef);
      this.mCellWidth = this.mResizeRef.size.width / this.props.width;
      this.mCellHeight = this.mResizeRef.size.height / this.props.height;
      this.mMinWidth = this.mCellWidth;
      this.mMinHeight = this.mCellHeight;
      this.mResizeAnchor = {
        x: this.mRef.offsetLeft,
        y: this.mRef.offsetTop,
        width: this.mResizeRef.size.width,
        height: this.mResizeRef.size.height,
      };
      this.mResizeUp = ["top", "topLeft", "topRight"].includes(dir);
      this.mResizeLeft = ["left", "topLeft", "bottomLeft"].includes(dir);
    } catch (err) {
      log("error", "failed to start resizing", {
        message: getErrorMessageOrDefault(err),
      });
    }
  };

  private resizeEnd = () => {
    this.nextState.resizing = false;
    this.mDrag.enable();

    this.packeryItem.moveTo(this.mRef.offsetLeft, this.mRef.offsetTop);

    this.mResizeRef.updateSize({ width: "100%", height: "100%" });

    this.props.packery.layout();
    (this.props.packery as any).sortItemsByPosition();

    this.packeryItem.disablePlacing();
    this.props.packery.unstamp(this.mRef);

    this.props.onUpdateLayout?.();
  };

  private resizeCallback = (
    event: MouseEvent | TouchEvent,
    direction: any,
    refToElement: HTMLDivElement,
    delta: any,
  ) => {
    const { size } = this.mResizeRef;

    if (this.mResizeLeft) {
      this.mRef.style.left = `${this.mResizeAnchor.x - (size.width - this.mResizeAnchor.width)}px`;
    }

    if (this.mResizeUp) {
      this.mRef.style.top = `${this.mResizeAnchor.y - (size.height - this.mResizeAnchor.height)}px`;
    }

    const newWidth = clamp(Math.ceil(size.width / this.mCellWidth), 1, 3);
    const newHeight = clamp(Math.ceil(size.height / this.mCellHeight), 1, 6);

    if (newWidth !== this.props.width) {
      this.props.onSetWidth(this.props.id, newWidth);
    }
    if (newHeight !== this.props.height) {
      this.props.onSetHeight(this.props.id, newHeight);
    }
  };

  private onContext = (event: React.MouseEvent<any>) => {
    this.nextState.context = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  private dismissWidget = () => {
    if (this.props.onDismiss !== undefined) {
      return this.props.onDismiss(this.props.id);
    }
  };

  private setRef = (ref) => {
    const { fixed } = this.props;
    if (ref === null && this.mRef !== null) {
      this.props.packery.remove(this.mRef);
    }
    this.mRef = ref;
    if (!fixed) {
      this.makeDraggable(this.props);
    }
  };

  private makeDraggable(props: IPackeryItemProps) {
    if (this.mRef === null || props.packery === undefined) {
      return;
    }

    this.mDrag = new Draggabilly.default(this.mRef, {
      handle: ".drag-handle",
    });

    props.packery.bindDraggabillyEvents(this.mDrag);
  }
}

export default PackeryItem;
