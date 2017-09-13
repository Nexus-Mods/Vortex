import More from '../../../controls/More';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { setMaxDownloads } from '../actions/settings';

import getText from '../texts';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import * as Redux from 'redux';

interface IConnectedProps {
  parallelDownloads: number;
}

interface IActionProps {
  onSetMaxDownloads: (value: number) => void;
}

type IProps = IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, parallelDownloads } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>
            {t('Download Threads') + ': ' + parallelDownloads.toString()}
            <More id='more-download-threads' name={t('Download Threads')} >
              {getText('download-threads', t)}
            </More>
          </ControlLabel>
          <FormControl
            type='range'
            value={parallelDownloads}
            min={1}
            max={10}
            onChange={this.onChangeParallelDownloads}
          />
        </FormGroup>
      </form>
    );
  }

  private onChangeParallelDownloads = (evt) => {
    const { onSetMaxDownloads } = this.props;
    onSetMaxDownloads(evt.currentTarget.value);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    parallelDownloads: state.settings.downloads.maxParallelDownloads,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetMaxDownloads: (value: number) => dispatch(setMaxDownloads(value)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      Settings)) as React.ComponentClass<{}>;
