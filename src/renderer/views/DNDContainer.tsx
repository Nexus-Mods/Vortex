import React, { type FC } from "react";

interface IDNDContainerProps {
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * This is pointless at this point and could probably be removed, moving the style
 * up to the parent, but I'll have to admit I don't understand 100% how "context" and
 * "manager" work in react-dnd and what changed in its api since we needed this.
 */
export const DNDContainer: FC<IDNDContainerProps> = (props) => {
  const { children, style } = props;

  // Return null if no children provided
  if (!children) {
    return null;
  }

  return <div style={style}>{children}</div>;
};

export default DNDContainer;
