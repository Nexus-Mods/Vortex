import Icon from '../../controls/Icon';

import * as React from 'react';
import { Image } from 'react-bootstrap';
import { pathToFileURL } from 'url';

export interface IToolIconProps {
  valid: boolean;
  imageUrl: string;
  imageId?: number;
}

const ToolIcon = (props: IToolIconProps) => {
  const validClass = props.valid ? 'valid' : 'invalid';
  if (props.imageUrl !== undefined) {
    let src = pathToFileURL(props.imageUrl).href;
    if (props.imageId !== undefined) {
      src += '?' + props.imageId;
    }
    return (
      <Image
        src={src}
        className={'tool-icon ' + validClass}
      />
    );
  } else {
    return (
      <Icon
        name='executable'
        className={'tool-icon ' + validClass}
      />
    );
  }
};

export default ToolIcon;
