import { addParameters, configure } from '@storybook/react';
import { INITIAL_VIEWPORTS } from '@storybook/addon-viewport';

import '../index.scss';
import './repair.scss';

const viewports = {
  fullhd: {
    name: 'FullHD',
    styles: {
      width: '1920px',
      height: '1080px',
    },
    type: 'desktop',
    default: true,
  },
  uhd: {
    name: 'UHD',
    styles: {
      width: '3840px',
      height: '2160px',
    },
    type: 'desktop',
  },
  minimal: {
    name: 'Minimal',
    styles: {
      width: '1024px',
      height: '700px',
    },
    type: 'desktop',
  }
};

addParameters({
  viewport: {
    viewports,
  },
});

configure(require.context('../src', true, /\.stories\.js$/), module);
