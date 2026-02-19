import { Dialog } from "@headlessui/react";
import { mdiClose } from "@mdi/js";
import React, { type PropsWithChildren, type RefObject } from "react";

import { Icon } from "../icon/Icon";
import { Typography } from "../typography/Typography";
import { joinClasses } from "../../utils/joinClasses";

type ModalSize = "sm" | "md" | "lg" | "xl";

const modalSize: { [key in ModalSize]: string } = {
  sm: "max-w-xs",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
};

type ModalProps = PropsWithChildren<{
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
}>;

export const ModalWrapper = ({
  children,
  className,
  initialFocusRef,
  isOpen = false,
  onClose,
}: ModalProps) => (
  <Dialog
    className={joinClasses([
      "fixed inset-0 z-modal flex flex-col items-center justify-center overflow-y-auto p-4",
      className,
    ])}
    initialFocus={initialFocusRef}
    open={isOpen}
    onClose={onClose}
  >
    <Dialog.Overlay className="fixed inset-0 -z-1 bg-translucent-dark-800" />

    {children}
  </Dialog>
);

type ModalPanelProps = {
  className?: string;
  size?: ModalSize;
  showCloseButton?: boolean;
  title?: string;
  onClose?: () => void;
};

export const ModalPanel = ({
  className,
  children,
  size = "md",
  showCloseButton = true,
  title,
  onClose,
}: PropsWithChildren<ModalPanelProps>) => (
  <Dialog.Panel
    className={joinClasses([
      "scrollbar relative w-full overflow-y-auto rounded-lg border border-surface-translucent-low bg-surface-low p-4 shadow-xl",
      modalSize[size],
      className,
    ])}
  >
    {!!title && (
      <Dialog.Title
        as={Typography}
        className={joinClasses(["mb-4 font-semibold"], {
          "mr-7": showCloseButton,
        })}
      >
        {title}
      </Dialog.Title>
    )}

    {showCloseButton && (
      <button
        className="absolute top-3 right-3 flex cursor-pointer items-center justify-center p-1 text-neutral-strong transition-colors hover:text-neutral-moderate"
        onClick={onClose}
      >
        <Icon path={mdiClose} />
      </button>
    )}

    {children}
  </Dialog.Panel>
);

export const Modal = ({
  children,
  size = "md",
  title,
  onClose,
  ...props
}: ModalProps & ModalPanelProps) => (
  <ModalWrapper {...props} onClose={onClose}>
    <ModalPanel size={size} title={title} onClose={onClose}>
      {children}
    </ModalPanel>
  </ModalWrapper>
);
