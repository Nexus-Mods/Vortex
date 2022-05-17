import Icon from '../../../controls/Icon';
import { TFunction } from '../../../util/i18n';

import * as React from 'react';
import { Button } from 'react-bootstrap';

export interface IProps {
  t: TFunction;
  id: string;
  width: number;
  height: number;
  editable: boolean;
  onDismiss?: (id: string) => void;
}

function FixedItem(props: React.PropsWithChildren<IProps>): JSX.Element {
  const { t, id, editable, onDismiss, height, width } = props;

  const dismissWidget = React.useCallback(() => {
    if (onDismiss !== undefined) {
      return onDismiss(id);
    }
  }, [id, onDismiss]);

  const classes = [
    'fixed-item',
    `packery-height-${height}`,
    `fixed-width-${width}`,
  ];

  if (editable) {
    classes.push('packery-editmode');
  }

  return (
    <div
      className={classes.join(' ')}
    >
      {props.children}
      <div className='packery-buttons'>
        {(onDismiss !== undefined) && editable ? (
          <Button
            className='btn-embed'
            onClick={dismissWidget}
          >
            <Icon name='close-slim' />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default FixedItem;
