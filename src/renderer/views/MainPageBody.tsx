import * as React from "react";

export function MainPageBody(
  props: React.HTMLAttributes<HTMLDivElement>,
): React.JSX.Element {
  return (
    <div className="main-page-body" {...props}>
      {props.children}
    </div>
  );
}

export default MainPageBody;
