import React from 'react';
import { tooltip, types } from 'vortex-api';
import { CompatibilityStatus } from './types';

export interface ICompatibilityIconProps {
  t: types.TFunction,
  mod: types.IMod,
  detailCell: boolean,
}

const iconMap: Record<CompatibilityStatus, string> = {
  broken: 'feedback-error',
  obsolete: 'feedback-error',
  abandoned: 'feedback-warning',
  unofficial: 'feedback-warning',
  workaround: 'feedback-warning',
  unknown: 'feedback-info',
  optional: 'feedback-success',
  ok: 'feedback-success',
};

function CompatibilityIcon(props: ICompatibilityIconProps) {
  const { t, mod } = props;

  const version = mod.attributes?.manifestVersion
               ?? mod.attributes?.version;

  if ((mod.attributes?.compatibilityUpdate !== undefined)
      && (mod.attributes?.compatibilityUpdate !== version)) {
    return (
      <tooltip.Icon
        name='auto-update'
        tooltip={t('SMAPI suggests updating this mod to {{update}}. '
                  + 'Please use Vortex to check for mod updates', {
          replace: {
            update: mod.attributes?.compatibilityUpdate,
          },
        })}
      />
    );
  }

  const status = (mod.attributes?.compatibilityStatus ?? 'unknown').toLowerCase();
  const icon = iconMap[status] ?? iconMap['unknown'];
  return (
    <tooltip.Icon
      name={icon}
      className={`sdv-compatibility-${status}`}
      tooltip={mod.attributes?.compatibilityMessage ?? t('No information')}
    />
  );
}

export default CompatibilityIcon;
