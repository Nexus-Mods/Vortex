import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { setMaxDownloads } from '../actions/settings';

import * as React from 'react';
import { ControlLabel, FormGroup } from 'react-bootstrap';
import ReactSlider = require('rc-slider');

interface IBaseProps {
}

interface IConnectedProps {
  parallelDownloads: number;
}

interface IActionProps {
  onSetMaxDownloads: (value: number) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, parallelDownloads } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>{ t('Parallel downloads: ') + parallelDownloads.toString() }</ControlLabel>
          <ReactSlider
            value={ parallelDownloads }
            min={1}
            max={10}
            tipFormatter={ null }
            onChange={ this.onChangeParallelDownloads }
          />
        </FormGroup>
      </form>
    );
  }

  private onChangeParallelDownloads = (newValue) => {
    const { onSetMaxDownloads } = this.props;
    onSetMaxDownloads(newValue);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    parallelDownloads: state.settings.downloads.maxParallelDownloads,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onSetMaxDownloads: (value: number) => dispatch(setMaxDownloads(value)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(Settings)
  ) as React.ComponentClass<{}>;
