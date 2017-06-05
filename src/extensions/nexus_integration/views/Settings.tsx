import { showDialog } from '../../../actions/notifications';
import { DialogType, IDialogActions, IDialogContent } from '../../../types/IDialog';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { Button } from '../../../views/TooltipControls';
import { setAssociatedWithNXMURLs } from '../actions/settings';

import chromeAllowScheme from '../util/chromeAllowScheme';

import * as React from 'react';
import { Checkbox, FormGroup, HelpBlock } from 'react-bootstrap';

interface IBaseProps {
}

interface IConnectedProps {
  associated: boolean;
}

interface IActionProps {
  onAssociate: (associate: boolean) => void;
  onDialog: (type: DialogType, title: string,
             content: IDialogContent, actions: IDialogActions) => void;
  onShowError: (message: string, details: string | Error) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class Settings extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, associated } = this.props;

    return (
      <form>
        <FormGroup>
          <Checkbox
            checked={associated}
            onChange={this.associate}
            disabled={process.platform === 'linux'}
          >
            {t('Associate with NXM URLs')}
          </Checkbox>
          {process.platform === 'linux' ? <HelpBlock>Not supported on Linux</HelpBlock> : null}
          <p>
            {t('Fix nxm link on Chrome (Requires Chrome to be closed)')}
            <Button
              tooltip={t('Fix')}
              id='chrome-download-fix'
              onClick={this.chromeFix}
            >
              {t('Apply')}
            </Button>
          </p>
        </FormGroup>
      </form>
    );
  }

  private chromeFix = () => {
    const { onDialog, onShowError } = this.props;
    onDialog('info', 'Is Chrome running?', {
      message: 'Chrome has to be closed, otherwise this fix has no effect.',
    }, {
      Cancel: null,
      Continue: () => {
        chromeAllowScheme('nxm')
        .then((changed: boolean) => {
          if (changed) {
            onDialog('success', 'Success', {
              message: 'Fix was applied',
            }, {
              Close: null,
            });
          } else {
            onDialog('info', 'Nothing changed', {
              message: 'No change was necessary',
            }, {
              Close: null,
            });
          }
        })
        .catch((err: Error) => {
          onShowError('Failed to fix NXM handling in Chrome', err);
        });
      },
    });
  }

  private associate = (evt: React.MouseEvent<any>) => {
    const { onAssociate } = this.props;
    onAssociate((evt.target as HTMLInputElement).checked);
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
               content: IDialogContent, actions: IDialogActions) => {
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
