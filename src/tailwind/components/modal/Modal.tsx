import { Dialog } from "@headlessui/react";
import * as React from "react";
import { joinClasses } from "../next/utils";

type ModalSize = "sm" | "md" | "lg" | "xl";

// todo check these sizes
const modalSize: { [key in ModalSize]: string } = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

type ModalProps = React.PropsWithChildren<{
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
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

export const ModalPanel = ({
  className,
  children,
  size = "md",
}: React.PropsWithChildren<{ className?: string; size?: ModalSize }>) => (
  <Dialog.Panel
    className={joinClasses([
      "scrollbar bg-surface-low relative w-full overflow-y-auto shadow-xl",
      modalSize[size],
      className,
    ])}
  >
    {children}
  </Dialog.Panel>
);

export const Modal = ({
  children,
  size = "md",
  ...props
}: ModalProps & { size?: ModalSize }) => (
  <ModalWrapper {...props}>
    <ModalPanel size={size}>{children}</ModalPanel>
  </ModalWrapper>
);
