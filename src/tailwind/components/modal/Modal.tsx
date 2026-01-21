import { Dialog } from "@headlessui/react";
import React, { type PropsWithChildren, type RefObject } from "react";
import { joinClasses } from "../next/utils";
import { Typography } from "../next/typography";
import { Icon } from "../next/icon";

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
      "z-modal fixed inset-0 flex items-center flex-col justify-center overflow-y-auto p-4",
      className,
    ])}
    initialFocus={initialFocusRef}
    open={isOpen}
    onClose={onClose}
  >
    <Dialog.Overlay className="bg-translucent-dark-800 fixed inset-0 -z-1" />

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
      "scrollbar bg-surface-low relative w-full overflow-y-auto shadow-xl rounded-lg border border-surface-translucent-low p-4",
      modalSize[size],
      className,
    ])}
  >
    {!!title && (
      <Dialog.Title
        as={Typography}
        className={joinClasses(["font-semibold mb-4"], {
          "mr-7": showCloseButton,
        })}
      >
        {title}
      </Dialog.Title>
    )}

    {showCloseButton && (
      <button
        className="absolute flex justify-center items-center cursor-pointer p-1 top-3 right-3 text-neutral-strong hover:text-neutral-moderate transition-colors"
        onClick={onClose}
      >
        <Icon path="mdiClose" />
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
