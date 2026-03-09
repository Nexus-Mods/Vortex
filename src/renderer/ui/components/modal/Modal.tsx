import { Dialog } from "@headlessui/react";
import { mdiClose } from "@mdi/js";
import React, { type PropsWithChildren, type RefObject } from "react";

import { joinClasses } from "../../utils/joinClasses";
import { Icon } from "../icon/Icon";

type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = PropsWithChildren<{
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  size?: ModalSize;
  onClose: () => void;
}>;

export const ModalWrapper = ({
  children,
  className,
  initialFocusRef,
  isOpen = false,
  size,
  onClose,
}: ModalProps) => (
  <Dialog
    className={joinClasses([`nxm-modal nxm-modal-${size}`, className])}
    initialFocus={initialFocusRef}
    open={isOpen}
    onClose={onClose}
  >
    <Dialog.Overlay className="nxm-modal-overlay" />

    {children}
  </Dialog>
);

type ModalPanelProps = {
  className?: string;
  showCloseButton?: boolean;
  title?: string;
  onClose?: () => void;
};

export const ModalPanel = ({
  className,
  children,
  showCloseButton = true,
  title,
  onClose,
}: PropsWithChildren<ModalPanelProps>) => (
  <Dialog.Panel className={joinClasses(["nxm-modal-panel", className])}>
    {!!title && (
      <Dialog.Title
        as="div"
        className={joinClasses(["nxm-modal-title"], {
          "mr-7": showCloseButton,
        })}
      >
        {title}
      </Dialog.Title>
    )}

    {showCloseButton && (
      <button className="nxm-modal-close" onClick={onClose}>
        <Icon path={mdiClose} />
      </button>
    )}

    {children}
  </Dialog.Panel>
);

export const Modal = ({
  children,
  showCloseButton,
  title,
  onClose,
  ...props
}: ModalProps & ModalPanelProps) => (
  <ModalWrapper {...props} onClose={onClose}>
    <ModalPanel
      showCloseButton={showCloseButton}
      title={title}
      onClose={onClose}
    >
      {children}
    </ModalPanel>
  </ModalWrapper>
);
