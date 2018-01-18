import More from '../../../controls/More';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { setMaxDownloads } from '../actions/settings';

import getText from '../texts';

import opn = require('opn');
import * as React from 'react';
import { Button, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import * as Redux from 'redux';

interface IConnectedProps {
  parallelDownloads: number;
  isPremium: boolean;
}

interface IActionProps {
  onSetMaxDownloads: (value: number) => void;
}

type IProps = IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, isPremium, parallelDownloads } = this.props;

    return (
      <form>
        <FormGroup>
          <ControlLabel>
            {t('Download Threads') + ': ' + parallelDownloads.toString()}
            <More id='more-download-threads' name={t('Download Threads')} >
              {getText('download-threads', t)}
            </More>
          </ControlLabel>
          <div style={{ display: 'flex' }}>
            <FormControl
              type='range'
              value={parallelDownloads}
              min={1}
              max={10}
              onChange={this.onChangeParallelDownloads}
              disabled={!isPremium}
            />
            {!isPremium ? (
              <Button onClick={this.goBuyPremium} className='btn-download-go-premium'>
                {t('Buy Premium to set multiple threads')}
              </Button>
            ) : null}
          </div>
        </FormGroup>
      </form>
    );
  }

  private goBuyPremium = () => {
    opn('https://www.nexusmods.com/register/premium');
  }

  private onChangeParallelDownloads = (evt) => {
    const { onSetMaxDownloads } = this.props;
    onSetMaxDownloads(evt.currentTarget.value);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    parallelDownloads: state.settings.downloads.maxParallelDownloads,
    // TODO: this breaks encapsulation
    isPremium: getSafe(state, ['session', 'nexus', 'userInfo', 'isPremium'], false),
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
