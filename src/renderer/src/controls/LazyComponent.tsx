import * as React from "react";

export default function <T>(load: () => any) {
  let mod: {
    default: React.ComponentClass<any>;
  };
  return (props) => {
    if (mod === undefined) {
      mod = load();
    }
    return <mod.default {...props} />;
  };
}
