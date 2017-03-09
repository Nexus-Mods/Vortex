import Icon from '../../views/Icon';

import * as React from 'react';
import { Image } from 'react-bootstrap';

export interface IToolIconProps {
  valid: boolean;
  imageUrl: string;
  imageId: number;
}

const ToolIcon = (props: IToolIconProps) => {
  const validClass = props.valid ? 'valid' : 'invalid';
  if (props.imageUrl !== undefined) {
    return (
      <Image
        src={`${props.imageUrl}?${props.imageId}`}
        className={'tool-icon ' + validClass}
      />
    );
  } else {
    return (
      <Icon
        name='question-circle'
        className={'tool-icon ' + validClass}
      />
    );
  }
};

export default ToolIcon;
