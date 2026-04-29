import React, { Component, memo, type FC, type ReactNode } from "react";
import { Toaster } from "react-hot-toast";

import { log } from "../../logging";

const REPEAT_WINDOW_MS = 5000;

let toastSystemDisabled = false;
let lastCatchTime = 0;

export const isToastSystemDisabled = (): boolean => toastSystemDisabled;

interface IToastBoundaryState {
  failed: boolean;
}

class ToastErrorBoundary extends Component<
  { children: ReactNode },
  IToastBoundaryState
> {
  public state: IToastBoundaryState = { failed: false };

  public static getDerivedStateFromError(): IToastBoundaryState {
    return { failed: true };
  }

  public componentDidCatch(error: Error) {
    // goober (used by react-hot-toast) can throw during a render race.
    // Treat the first crash as transient and remount; if a second crash
    // lands within REPEAT_WINDOW_MS the issue isn't transient, so permanently
    // disable toasts and let sendNotification fall back to standard notifications.
    const now = Date.now();
    const repeated = now - lastCatchTime < REPEAT_WINDOW_MS;
    lastCatchTime = now;

    log("warn", "Toast renderer crashed", {
      message: error.message,
      repeated,
    });

    if (repeated) {
      toastSystemDisabled = true;
      return;
    }

    this.setState({ failed: false });
  }

  public render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export const ToastContainer: FC = memo(() => (
  <ToastErrorBoundary>
    <Toaster
      position="bottom-center"
      reverseOrder={false}
      toastOptions={{
        className: "custom-toast",
        success: {
          className: "custom-toast toast-success",
          iconTheme: {
            primary: "var(--toast-success-primary)",
            secondary: "var(--toast-success-secondary)",
          },
        },
        error: {
          className: "custom-toast toast-error",
          iconTheme: {
            primary: "var(--toast-error-primary)",
            secondary: "var(--toast-error-secondary)",
          },
        },
      }}
    />
  </ToastErrorBoundary>
));
