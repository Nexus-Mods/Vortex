import React, { type FC, type HTMLAttributes } from "react";

export const MainPageBody: FC<HTMLAttributes<HTMLDivElement>> = (props) => {
  return (
    <div className="main-page-body" {...props}>
      {props.children}
    </div>
  );
};

export default MainPageBody;
