import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { mdiClose } from "@mdi/js";
import React, { type PropsWithChildren, type RefObject } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

type IModalSize = "sm" | "md" | "lg" | "xl";

type IModalProps = PropsWithChildren<{
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  size?: IModalSize;
  onClose: () => void;
}>;

export const ModalWrapper = ({
  children,
  className,
  initialFocusRef,
  isOpen = false,
  size,
  onClose,
}: IModalProps) => (
  <Dialog
    className={joinClasses([`nxm-modal nxm-modal-${size}`, className])}
    initialFocus={initialFocusRef}
    open={isOpen}
    onClose={onClose}
  >
    <DialogBackdrop className="nxm-modal-overlay" />

    {children}
  </Dialog>
);

type IModalPanelProps = {
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
}: PropsWithChildren<IModalPanelProps>) => (
  <DialogPanel className={joinClasses(["nxm-modal-panel", className])}>
    {!!title && (
      <DialogTitle
        as="div"
        className={joinClasses(["nxm-modal-title"], {
          "mr-7": showCloseButton,
        })}
      >
        {title}
      </DialogTitle>
    )}

    {showCloseButton && (
      <button className="nxm-modal-close" onClick={onClose}>
        <Icon path={mdiClose} />
      </button>
    )}

    {children}
  </DialogPanel>
);

export const Modal = ({
  children,
  showCloseButton,
  title,
  onClose,
  ...props
}: IModalProps & IModalPanelProps) => (
  <ModalWrapper {...props} onClose={onClose}>
    <ModalPanel showCloseButton={showCloseButton} title={title} onClose={onClose}>
      {children}
    </ModalPanel>
  </ModalWrapper>
);
