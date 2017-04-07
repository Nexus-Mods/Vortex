import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';
import { FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';

export interface IBaseProps {
  mod: IMod;
  gameMode: string;
  changelogText: string;
}

export interface IChangelogButtonState {
  showLayer: string;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps;

/**
 * Changelog Button
 * 
 * @class ChangelogButton
 */
class ChangelogButton extends ComponentEx<IProps, IChangelogButtonState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
    };
  }

  public render(): JSX.Element {
    let { changelogText, mod, t } = this.props;

    const popoverBottom = (
      <Popover
        id='popover-positioned-scrolling-bottom'
        title={t('Changelog')}
      >
        <FormGroup key={mod.id}>
          <div key='dialog-form-changelog'>
           {changelogText}
          </div>
        </FormGroup>
      </Popover>
    );

    return (
        <OverlayTrigger trigger='click' rootClose placement='bottom' overlay={popoverBottom}>
          <IconButton
            className='btn-version-column'
            icon='file-text'
            id={mod.id}
            tooltip={t('Changelog')}
          />
        </OverlayTrigger>
    );
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(ChangelogButton)
  ) as React.ComponentClass<IBaseProps>;
