import Line from './Line';

import * as React from 'react';
import { connect } from 'react-redux';
import { ComponentEx, util } from 'vortex-api';

interface ICoord {
  x: number;
  y: number;
}

interface IConnectorProps {
  source?: { id: string, pos: ICoord };
  target?: { id: string, pos: ICoord };
  mode?: string;
}

class ConnectorImpl extends ComponentEx<IConnectorProps, {}> {
  constructor(props: IConnectorProps) {
    super(props);
  }

  public render(): JSX.Element {
    const { source, target } = this.props;

    let mode;
    if ((this.context as any).getModifiers().ctrl) {
      mode = 'after';
    }

    if ((source === undefined) || (target === undefined)) {
      return null;
    }

    const lineClass = target.id !== null ? 'line-connect' : 'line-disconnect';

    return (
      <Line
        source={source.pos}
        target={target.pos}
        className={lineClass}
        curved={target.id !== null}
        text={mode}
      />
    );
  }
}

function mapStateToProps(state: any): IConnectorProps {
  return {
    source:
      util.getSafe(state, ['session', 'pluginDependencies', 'connection', 'source'], undefined),
    target:
      util.getSafe(state, ['session', 'pluginDependencies', 'connection', 'target'], undefined),
  };
}

export default connect(mapStateToProps)(ConnectorImpl) as any;
