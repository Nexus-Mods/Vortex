import memoizeOne from "memoize-one";
import * as React from "react";
import type { ModalBody, ModalFooter, ModalHeader, ModalTitle } from "react-bootstrap";
import { Modal } from "react-bootstrap";

import { ComponentExProvider, MainContext } from "../contexts/main_context/MainContext";
import type { IComponentContext } from "../types/IComponentContext";
import { MutexWrapper } from "../util/MutexContext";

class MyModal extends React.PureComponent<typeof Modal.prototype.props, {}> {
  public static Header: typeof ModalHeader = Modal.Header;
  public static Title: typeof ModalTitle = Modal.Title;
  public static Body: typeof ModalBody = Modal.Body;
  public static Footer: typeof ModalFooter = Modal.Footer;

  public static contextType = MainContext;
  declare public context: IComponentContext;

  private getContainer = memoizeOne(() => this.getContainerImpl());

  // What's inside the dialog gets its own menu layer, so a menu opened there sits above the
  // dialog rather than behind it.
  private getInnerContext = memoizeOne(
    (outer: IComponentContext, menuLayer: HTMLDivElement): IComponentContext => ({
      ...outer,
      menuLayer,
    }),
  );

  private mMenuLayer: HTMLDivElement = null;

  public render(): JSX.Element {
    return (
      <div className="modal-container">
        <MutexWrapper show={this.props.show}>
          <Modal {...this.props} container={this.getContainer()}>
            <div className="menu-layer" ref={this.setMenuLayer} />
            {this.mMenuLayer !== null ? (
              <MainContext.Provider value={this.getInnerContext(this.context, this.mMenuLayer)}>
                <ComponentExProvider>{this.props.children}</ComponentExProvider>
              </MainContext.Provider>
            ) : null}
          </Modal>
        </MutexWrapper>
      </div>
    );
  }

  private getContainerImpl() {
    return document.getElementById("overlays");
  }

  private setMenuLayer = (ref: HTMLDivElement) => {
    this.mMenuLayer = ref;
    this.forceUpdate();
  };
}

export default MyModal;
