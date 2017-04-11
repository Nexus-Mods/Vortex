import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';
import { FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';

export interface IBaseProps {
  t: I18next.TranslationFunction;
  mod: IMod;
}

type IProps = IBaseProps;

/**
 * VersionChangelog Button
 * 
 * @class VersionChangelogButton
 */
class VersionChangelogButton extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    let { mod, t } = this.props;

    let changelog = getSafe(mod.attributes, ['changelogHtml'], undefined);

    if (!truthy(changelog)) {
      return null;
    }

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

export default VersionChangelogButton as React.ComponentClass<IBaseProps>;
