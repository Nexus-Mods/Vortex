import * as React from "react";

export interface IGameNameProps {
  name: string;
  // compact tiles (e.g. the Recently Managed dashlet) are too small to fit
  // a name; rely on the thumbnail art and the container's tooltip instead
  compact?: boolean;
}

function GameName(props: IGameNameProps): JSX.Element | null {
  const { compact, name } = props;

  return compact ? null : <div className="name">{name}</div>;
}

export default GameName;
