import * as React from 'react';

import { II18NProps } from '../types/II18NProps';

export { translate } from 'react-i18next';
export { connect } from 'react-redux';
export { extend } from './ExtensionProvider';

export class ComponentEx<P, S> extends React.Component<P & II18NProps, S> {}
