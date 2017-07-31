import bbcode from '../../../util/bbcode';

import * as I18next from 'i18next';
import * as React from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';

interface IBaseProps {
  t: I18next.TranslationFunction;
  short: string;
  long: string;
}

type IProps = IBaseProps;

class Description extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const {t, long, short} = this.props;

    const popover = (
        <Popover id='popover-mod-description'>
          <div style={{ maxHeight: 700, overflowY: 'auto' }}>{bbcode(long)}</div>
        </Popover>
    );

    return (
      <OverlayTrigger trigger='click' overlay={popover} rootClose placement='left'>
        <p className='p-link'>{bbcode(short)}</p>
      </OverlayTrigger>
    );
  }
}

export default Description;
