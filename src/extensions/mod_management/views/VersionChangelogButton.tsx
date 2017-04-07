import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';
import { FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';

export interface IBaseProps {
  mod: IMod;
}

export interface IVersionChangelogButtonState {
  showLayer: string;
}

interface IConnectedProps {
}

type IProps = IBaseProps & IConnectedProps;

/**
 * VersionChangelog Button
 * 
 * @class VersionChangelogButton
 */
class VersionChangelogButton extends ComponentEx<IProps, IVersionChangelogButtonState> {

  constructor(props: IProps) {
    super(props);

    this.state = {
      showLayer: '',
    };
  }

  public render(): JSX.Element {
    let { mod, t } = this.props;

    let changelog = getSafe(mod.attributes, ['changelogHtml'], null);
    const regex = /<br[^>]*>/gi;
    if (changelog !== null) {
      changelog = changelog.replace(regex, '\n');
    }

    const popoverBottom = (
      <Popover
        id='popover-positioned-scrolling-bottom'
        title={t('Changelog')}
      >
        <FormGroup key={mod.id}>
          <div key='dialog-form-changelog'>
            {changelog}
          </div>
        </FormGroup>
      </Popover>
    );

    if (changelog !== undefined) {

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
    } else {
      return null;
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {};
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps)(VersionChangelogButton)
  ) as React.ComponentClass<IBaseProps>;
