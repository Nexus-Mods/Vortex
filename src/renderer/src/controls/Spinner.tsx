import * as React from "react";

import Icon from "./Icon";

export interface ISpinnerProps {
  style?: React.CSSProperties;
  className?: string;
}

function Spinner(props: ISpinnerProps) {
  return <Icon className={props.className} name="spinner_new" style={props.style} spin />;
}

export default Spinner;
