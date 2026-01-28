import * as React from "react";

import { MainPageBody } from "./MainPageBody";
import { MainPageHeader } from "./MainPageHeader";

// Vortex's backend depends on this, be careful when changing!

export interface IBaseProps {
  id?: string;
  className?: string;
  domRef?: (ref: HTMLElement) => void;
  children?: React.ReactNode;
}

const MainPageInner = React.forwardRef<HTMLDivElement, IBaseProps>(
  ({ children, className, domRef, id }, ref) => {
    // Support both ref (forwardRef) and domRef (legacy callback ref)
    const setRef = React.useCallback(
      (element: HTMLDivElement | null) => {
        // Handle forwardRef
        if (typeof ref === "function") {
          ref(element);
        } else if (ref) {
          ref.current = element;
        }
        // Handle legacy domRef callback
        if (domRef && element) {
          domRef(element);
        }
      },
      [ref, domRef],
    );

    return (
      <div
        className={(className || "") + " main-page-inner"}
        id={id}
        ref={setRef}
      >
        {children}
      </div>
    );
  },
);

MainPageInner.displayName = "MainPage";

export const MainPage = MainPageInner as typeof MainPageInner & {
  Body: typeof MainPageBody;
  Header: typeof MainPageHeader;
};

MainPage.Body = MainPageBody;
MainPage.Header = MainPageHeader;

export default MainPage;
