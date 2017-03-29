import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';
import { FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';

export interface IBaseProps {
  mod: IMod;
  gameMode: string;
  changelogsText: string;
}

export interface IChangelogsButtonState {
  showLayer: string;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps;

/**
 * Changelogs Button
 * 
 * @class ChangelogsButton
 */
class ChangelogsButton extends ComponentEx<IProps, IChangelogsButtonState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
    };
  }

  public render(): JSX.Element {
    let { changelogsText, mod, t } = this.props;

    const popoverBottom = (
      <Popover
        id='popover-positioned-scrolling-bottom'
        title={t('Changelogs')}
      >
        <FormGroup key={mod.id}>
          <div key='dialog-form-changelogs'>
           {changelogsText}
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
    connect(mapStateToProps)(ChangelogsButton)
  ) as React.ComponentClass<IBaseProps>;
