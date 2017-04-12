import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';
import { ControlLabel, FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';

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
    let newestChangelog = getSafe(mod.attributes, ['newestChangelogHtml'], undefined);

    if (!truthy(changelog) || !truthy(newestChangelog)) {
      return null;
    }

    const regex = /<br[^>]*>/gi;
    if (changelog !== null) {
      changelog = changelog.replace(regex, '\n');
    }

    if (newestChangelog !== null) {
      newestChangelog = newestChangelog.replace(regex, '\n');
    }

    const popoverBottom = (
      <Popover
        id='popover-positioned-scrolling-bottom'
        title={t('Changelogs')}
      >
        <FormGroup key={mod.id}>
          <ControlLabel>{t('Current Changelog')}</ControlLabel>
          <div key='dialog-form-changelog'>
            {changelog}
          </div>
          <ControlLabel>{t('Next Changelog')}</ControlLabel>
          <div key='dialog-form-newestChangelog'>
            {newestChangelog}
          </div>
        </FormGroup>
      </Popover>
    );

    return (
      <OverlayTrigger trigger='click' rootClose placement='right' overlay={popoverBottom}>
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
