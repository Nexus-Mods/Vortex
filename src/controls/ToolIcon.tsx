import Icon from './Icon';

import * as React from 'react';
import { Image } from 'react-bootstrap';
import { pathToFileURL } from 'url';
import { IconButton } from './TooltipControls';
import { TFunction } from '../util/i18n';

export interface IToolIconProps {
  t?: TFunction;
  children?: any;
  classes?: string[];
  valid: boolean;
  isPrimary?: boolean;
  imageUrl: string;
  imageId?: number;
  onRun?: () => void;
}

const ToolIcon = (props: IToolIconProps) => {
  const validClass = props.valid ? 'valid' : 'invalid';
  let iconImage;
  if (props.imageUrl !== undefined) {
    let src = pathToFileURL(props.imageUrl).href;
    if (props.imageId !== undefined) {
      src += '?' + props.imageId;
    }
    iconImage = (
      <Image
        src={src}
        className={'tool-icon ' + validClass}
      />
    );
  } else {
    iconImage = (
      <Icon
        name='executable'
        className={'tool-icon ' + validClass}
      />
    );
  }

  const classes = props.classes ?? [];
  const containerClasses = props.isPrimary
    ? ['starter-tool-icon-container', 'primary', ...classes]
    : ['starter-tool-icon-container', ...classes];
  return (
    <div className={containerClasses.join(' ')}>
      {iconImage}
      {props.isPrimary ? <div className='primary-star'>★</div> : null}
      {props.valid && props.t
        ? <IconButton icon='launch-simple' tooltip={props.t('Run')} onClick={props.onRun} className='run-tool'/>
        : null}
      {props.children}
    </div>
  );
};

export default ToolIcon;
