import * as React from 'react';

import { II18NProps } from '../types/II18NProps';

export { translate } from 'react-i18next';
export { connect } from 'react-redux';
export { extend } from './ExtensionProvider';

/**
 * convenience extension for React.Component that adds support for the
 * i18n library.
 * 
 * This whole module is just here to reduce the code required for "decorated"
 * components.
 * 
 * @export
 * @class ComponentEx
 * @extends {(React.Component<P & II18NProps, S>)}
 * @template P
 * @template S
 */
export class ComponentEx<P, S> extends React.Component<P & II18NProps, S> {}
