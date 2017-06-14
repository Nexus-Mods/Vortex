import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { IconButton } from '../../../views/TooltipControls';

import { IMod } from '../../mod_management/types/IMod';

import * as React from 'react';
import { ControlLabel, FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';
import * as ReactSafeHtml from 'react-safe-html';

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
    const { mod, t } = this.props;

    const changelog = getSafe(mod.attributes, ['changelog'], undefined);
    const newestChangelog = getSafe(mod.attributes, ['newestChangelog'], undefined);

    if (!truthy(changelog) && !truthy(newestChangelog)) {
      return null;
    }

    const popoverBottom = (
      <Popover
        id='popover-changelog'
        title={t('Changelogs')}
      >
        <FormGroup>
          <ControlLabel>{t('Current Version')}</ControlLabel>
          <div key='dialog-form-changelog'>
            {this.renderChangelog(changelog)}
          </div>
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Newest Version')}</ControlLabel>
          <div key='dialog-form-newestChangelog'>
            {this.renderChangelog(newestChangelog)}
          </div>
        </FormGroup>
      </Popover>
    );

    return (
      <OverlayTrigger trigger='click' rootClose placement='right' overlay={popoverBottom}>
        <IconButton
          className='btn-embed'
          icon='file-text'
          id={`btn-changelog-${mod.id}`}
          tooltip={t('Changelog')}
        />
      </OverlayTrigger>
    );
  }

  private renderChangelog(changelog: { format: 'html' | 'text', content: string}): JSX.Element {
    if (changelog === undefined) {
      return null;
    }
    if (changelog.format === 'html') {
      const components = ReactSafeHtml.components.makeElements({});
      components.br = ReactSafeHtml.components.createSimpleElement('br', {});

      return <ReactSafeHtml html={changelog.content} components={components} />;
    } else {
      return <p>{changelog.content}</p>;
    }
  }
}

export default VersionChangelogButton as React.ComponentClass<IBaseProps>;
