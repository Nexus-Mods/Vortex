import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';

import { IMod } from '../../mod_management/types/IMod';

import { TFunction } from 'i18next';
import * as React from 'react';
import { ControlLabel, FormGroup, OverlayTrigger, Popover } from 'react-bootstrap';
import Interweave, { ElementAttributes, Filter } from 'interweave';

class LinkFilter extends Filter {
  public attribute<K extends keyof ElementAttributes>(name: K, value: ElementAttributes[K]): ElementAttributes[K] | null | undefined {
    if (['href', 'src'].includes(name)) {
      return undefined;
    }

    return value;
  }

  public node(name: string, node: HTMLElement): HTMLElement {
    if (name === 'a') {
      for (let i = 0; i < node.attributes.length; ++i) {
        node.removeAttributeNode(node.attributes[i]);
      }
    }

    return node;
  }
}

export interface IBaseProps {
  t: TFunction;
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
        <div
          style={{ maxHeight: 500, overflowY: 'auto' }}
        >
        <FormGroup>
          <ControlLabel>{t('Current Version')}</ControlLabel>
          <div key='dialog-form-changelog' className='mod-changelog'>
            {this.renderChangelog(changelog)}
          </div>
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Newest Version')}</ControlLabel>
          <div key='dialog-form-newestChangelog' className='mod-changelog'>
            {this.renderChangelog(newestChangelog)}
          </div>
        </FormGroup>
        </div>
      </Popover>
    );

    return (
      <OverlayTrigger trigger='click' rootClose placement='right' overlay={popoverBottom}>
        <IconButton
          className='btn-embed'
          icon='changelog'
          id={`btn-changelog-${mod.id}`}
          tooltip={t('Changelog')}
        />
      </OverlayTrigger>
    );
  }

  private renderChangelog(changelog: { format: 'html' | 'text', content: string}): JSX.Element {
    const { t } = this.props;
    if (changelog === undefined) {
      return null;
    }
    if (changelog.format === 'html') {
      try {
        return <Interweave content={changelog.content} filters={[new LinkFilter()]} />;
      } catch (err) {
        // probably caused by an odd, very very rare bug loading included modules
        return <p>{t('Parsing the changelog failed')}</p>;
      }
    } else {
      return <p>{changelog.content}</p>;
    }
  }
}

export default VersionChangelogButton as React.ComponentClass<IBaseProps>;
