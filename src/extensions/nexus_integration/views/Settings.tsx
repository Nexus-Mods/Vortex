import { addNotification } from '../../../actions';
import { showDialog } from '../../../actions/notifications';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import Toggle from '../../../controls/Toggle';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent } from '../../../types/IDialog';
import { IErrorOptions } from '../../../types/IExtensionContext';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import opn from '../../../util/opn';
import { setAssociatedWithNXMURLs } from '../actions/settings';

import chromeAllowScheme from '../util/chromeAllowScheme';

import { NEXUS_BASE_URL } from '../constants';
import getText from '../texts';

import * as React from 'react';
import { Alert, FormGroup, HelpBlock } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

function nop() {
  // nop
}

function DownloadButton(): JSX.Element {
  return (
    <div className='nexusmods-action-button'>
      <Icon
        id='nexus-dl-icon'
        name='nexus'
      />
      <a className='nexusmods-fake-link' onClick={nop}>Mod Manager Download</a>
    </div>
  );
}

interface IBaseProps {
}

interface IConnectedProps {
  associated: boolean;
}

interface IActionProps {
  onAssociate: (associate: boolean) => void;
  onDialog: (type: DialogType, title: string,
             content: IDialogContent, actions: DialogActions) => void;
  onShowError: (message: string, details: string | Error, options?: IErrorOptions) => void;
  onShowInfo: (message: string) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  private mHelpText: string;
  constructor(props: IProps) {
    super(props);

    this.mHelpText = getText('chrome-fix', this.props.t);
  }

  public render(): JSX.Element {
    const { t, associated } = this.props;

    return (
      <form>
        <FormGroup>
          <Toggle
            checked={associated}
            onToggle={this.associate}
            disabled={process.platform === 'linux'}
          >
            {t('Handle')}{' '}<DownloadButton/>{t('buttons on')}{' '}
            {<a onClick={this.openNexus}>NexusMods.com</a>}
          </Toggle>
          {
            // on linux this is handled by the desktop environment so you'd have to implement
            // separate solutions for kde, gnome, xfce, ...
            (process.platform === 'linux')
            ? <HelpBlock><Alert bsStyle='info'>{t('Not supported on Linux')}</Alert></HelpBlock>
            : null
          }
          <div style={{ marginTop: 15 }}>
            {t('Fix Nexus Mods links in Chrome '
              + '(Only required for Chrome. Requires Chrome to be closed)')}
            <More id='more-chrome-fix' name={t('Chrome Fix')}>
              {this.mHelpText}
            </More>
            <Button
              tooltip={t('Fix')}
              id='chrome-download-fix'
              onClick={this.chromeFix}
              style={{ marginLeft: 5 }}
            >
              {t('Fix Now')}
            </Button>
          </div>
        </FormGroup>
      </form>
    );
  }

  private openNexus = () => {
    opn(NEXUS_BASE_URL).catch(() => null);
  }

  private chromeFix = () => {
    const { onDialog, onShowError } = this.props;
    onDialog('info', 'Is Chrome running?', {
      bbcode: 'Chrome has to be closed, otherwise this fix has no effect.<br/>'
            + '[color="red"]IMPORTANT: You may have to repeat this step after '
            + 'clearing the cache inside chrome![/color]',
    }, [
        { label: 'Cancel' },
        {
          label: 'Continue', action: () => {
            chromeAllowScheme('nxm')
              .then((changed: boolean) => {
                if (changed) {
                  onDialog('success', 'Success', {
                    text: 'Fix was applied.',
                  }, [ { label: 'Close' } ]);
                } else {
                  onDialog('info', 'Nothing Changed', {
                    text: 'No change was necessary.',
                  }, [ { label: 'Close' } ]);
                }
              })
              .catch(err => {
                if (err.code === 'ENOENT') {
                  onShowError(
                    'Failed to fix NXM handling in Chrome',
                    'Could not determine the chrome preferences file to fix. '
                    + 'Please read the help text for this fix and apply '
                    + 'it manually.',
                    { allowReport: false },
                  );
                } else {
                  onShowError('Failed to fix NXM handling in Chrome. ', err,
                              { allowReport: false });
                }
              });
          },
        },
    ]);
  }

  private associate = (enabled: boolean) => {
    const { onAssociate, onShowInfo } = this.props;
    if (!enabled) {
      onShowInfo('Nexus Mods Links are now unhandled.\n'
        + 'To have another application handle those links you have to go to that\n'
        + 'application and enable handling of NXM links there.');
    }
    onAssociate(enabled);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    associated: state.settings.nexus.associateNXM,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onAssociate: (associate: boolean): void => {
      dispatch(setAssociatedWithNXMURLs(associate));
    },
    onDialog: (type: DialogType, title: string,
               content: IDialogContent, actions: DialogActions) => {
      dispatch(showDialog(type, title, content, actions));
    },
    onShowError: (message: string, details: string | Error, options: IErrorOptions) => {
      showError(dispatch, message, details, options);
    },
    onShowInfo: (message: string) => dispatch(addNotification({
      type: 'info',
      message,
    })),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(Settings),
  ) as React.ComponentClass<{}>;
