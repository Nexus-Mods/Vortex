import { byTypeIndex, typeDescription } from './filetypes';

import * as React from 'react';
import { ComponentEx, tooltip, types, util } from 'vortex-api';

interface IModContentProps {
  mod: types.IMod;
}

class ModContent extends ComponentEx<IModContentProps, {}> {
  public render() {
    const { t, mod } = this.props;
    const IconX: any = tooltip.Icon;

    const content = util.getSafe(mod.attributes, ['noContent'], false)
      ? <div className='mod-content-empty' >{t('Empty')}</div>
      : util.getSafe(mod.attributes, ['content'], [])
        .slice(0).sort(byTypeIndex)
        .map((typeId: string) => (typeDescription[typeId] !== undefined) ? (
          <IconX
            key={typeId}
            set='mod-content'
            name={typeDescription[typeId].icon}
            tooltip={t(typeDescription[typeId].tooltip)}
          />
        ) : null);

    return (
      <div className='mod-content-icons'>
        {content}
      </div>
    );
  }
}

export default ModContent;
