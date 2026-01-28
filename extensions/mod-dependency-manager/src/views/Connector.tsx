import Line from "./Line";

import * as _ from "lodash";
import * as React from "react";
import { connect } from "react-redux";
import { ComponentEx, util } from "vortex-api";

interface ICoord {
  x: number;
  y: number;
}

interface IConnectorProps {
  source?: { id: string; pos: ICoord };
  target?: { id: string; pos: ICoord };
}

class ConnectorImpl extends ComponentEx<IConnectorProps, {}> {
  public shouldComponentUpdate(nextProps: IConnectorProps) {
    return (
      !_.isEqual(this.props.source, nextProps.source) ||
      !_.isEqual(this.props.target, nextProps.target)
    );
  }

  public render(): JSX.Element {
    const { source, target } = this.props;

    if (source === undefined || target === undefined) {
      return null;
    }

    const lineClass = target.id !== null ? "line-connect" : "line-disconnect";

    return (
      <Line
        source={source.pos}
        target={target.pos}
        className={lineClass}
        curved={target.id !== null}
      />
    );
  }
}

function mapStateToProps(state: any): IConnectorProps {
  return {
    source: util.getSafe(
      state,
      ["session", "dependencies", "connection", "source"],
      undefined,
    ),
    target: util.getSafe(
      state,
      ["session", "dependencies", "connection", "target"],
      undefined,
    ),
  };
}

export default connect(mapStateToProps)(
  ConnectorImpl,
) as React.ComponentType<{}>;
