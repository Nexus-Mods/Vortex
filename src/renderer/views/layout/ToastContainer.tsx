import * as React from "react";
import { Toaster } from "react-hot-toast";

const ToastContainer: React.FC = React.memo(() => (
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
));

export default ToastContainer;
