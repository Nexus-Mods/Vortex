import { withInfo } from "@storybook/addon-info";
import { withKnobs } from '@storybook/addon-knobs';
import React from 'react';
import IconBase from './IconBase';
import IconBar from './IconBar';

const sets = {
  icons: new Set(['sample', 'spinner']),
};

function getSet(set) {
  return Promise.resolve(sets[set]);
}

function Icon(props) {
  return <IconBase {...props} getSet={getSet} />;
}

export default {
  title: 'IconBar',
  parameters: {
    componentSubtitle: 'Control containing multiple buttons',
    decorators: [withInfo, withKnobs],
    info: {
      inline: true,
    }
  }
};

export const simple = () => (
  <IconBar
    IconComponent={Icon}
  />
);
