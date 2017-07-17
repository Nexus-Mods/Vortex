import BrTag from './bbcode/BrTag';
import LinkTag from './bbcode/LinkTag';
import SizeTag from './bbcode/SizeTag';
import SpoilerTag from './bbcode/SpoilerTag';

import * as bbcode from 'bbcode-to-react';
import * as I18next from 'i18next';
import * as React from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';

bbcode.registerTag('size', SizeTag);
bbcode.registerTag('br', BrTag);
bbcode.registerTag('email', LinkTag);
bbcode.registerTag('link', LinkTag);
bbcode.registerTag('url', LinkTag);
bbcode.registerTag('spoiler', SpoilerTag);

interface IBaseProps {
  t: I18next.TranslationFunction;
  short: string;
  long: string;
}

type IProps = IBaseProps;

class Description extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const {t, long, short} = this.props;

    const longDecoded = bbcode.toReact(long
      .replace(/<br *\/?>/g, '[br][/br]')
      .replace(/&#([0-9]+);/g, (m, num) => String.fromCharCode(num)));

    const popover = (
        <Popover id='popover-mod-description'>
          <div style={{ maxHeight: 700, overflowY: 'auto' }}>{longDecoded}</div>
        </Popover>
    );

    return (
      <OverlayTrigger trigger='click' overlay={popover} rootClose placement='left'>
        <p className='p-link'>{short || t('Description')}</p>
      </OverlayTrigger>
    );
  }
}

export default Description;
