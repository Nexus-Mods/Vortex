import React, { type HTMLAttributes } from "react";

export const MainPageBody = React.forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>((props, ref) => (
  <div className="main-page-body" ref={ref} {...props}>
    {props.children}
  </div>
));

MainPageBody.displayName = "MainPageBody";

export default MainPageBody;
