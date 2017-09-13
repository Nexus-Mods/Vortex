import { showDialog } from '../../../actions/notifications';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import Toggle from '../../../controls/Toggle';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent } from '../../../types/IDialog';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { setAssociatedWithNXMURLs } from '../actions/settings';

import chromeAllowScheme from '../util/chromeAllowScheme';

import getText from '../texts';

import * as React from 'react';
import { Checkbox, FormGroup, HelpBlock } from 'react-bootstrap';
import * as Redux from 'redux';

function nop() {
  // nop
}

function DownloadButton(): JSX.Element {
  return (
    <div className='nexusmods-action-button'>
      <Icon name='nexus' svgStyle='.st0, .st1, #path11 { fill-opacity: 0 !important }' />
      <a className='nexusmods-fake-link' onClick={nop}>Download with Manager</a>
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
  onShowError: (message: string, details: string | Error) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
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
            {t('Handle ')}<DownloadButton/>{t('buttons on nexusmods.com')}
          </Toggle>
          {process.platform === 'linux' ? <HelpBlock>Not supported on Linux</HelpBlock> : null}
          <div style={{ marginTop: 15 }}>
            {t('Fix nexusmods-links in Chrome (Requires Chrome to be closed)')}
            <More id='more-chrome-fix' name={t('Chrome Fix')}>{getText('chrome-fix', t)}</More>
            <Button
              tooltip={t('Fix')}
              id='chrome-download-fix'
              onClick={this.chromeFix}
              style={{ marginLeft: 5 }}
            >
              {t('Fix now')}
            </Button>
          </div>
        </FormGroup>
      </form>
    );
  }

  private chromeFix = () => {
    const { onDialog, onShowError } = this.props;
    onDialog('info', 'Is Chrome running?', {
      message: 'Chrome has to be closed, otherwise this fix has no effect.',
    }, [
        { label: 'Cancel' },
        {
          label: 'Continue', action: () => {
            chromeAllowScheme('nxm')
              .then((changed: boolean) => {
                if (changed) {
                  onDialog('success', 'Success', {
                    message: 'Fix was applied',
                  }, [ { label: 'Close' } ]);
                } else {
                  onDialog('info', 'Nothing changed', {
                    message: 'No change was necessary',
                  }, [ { label: 'Close' } ]);
                }
              })
              .catch((err: Error) => {
                onShowError('Failed to fix NXM handling in Chrome', err);
              });
          },
        },
    ]);
  }

  private associate = (enabled: boolean) => {
    const { onAssociate } = this.props;
    onAssociate(enabled);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    associated: state.settings.nexus.associateNXM,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAssociate: (associate: boolean): void => {
      dispatch(setAssociatedWithNXMURLs(associate));
    },
    onDialog: (type: DialogType, title: string,
               content: IDialogContent, actions: DialogActions) => {
      dispatch(showDialog(type, title, content, actions));
    },
    onShowError: (message: string, details: string | Error) => {
      showError(dispatch, message, details);
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(Settings),
  ) as React.ComponentClass<{}>;
