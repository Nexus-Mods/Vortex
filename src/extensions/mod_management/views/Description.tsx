import BrTag from './bbcode/BrTag';
import FontTag from './bbcode/FontTag';
import LineTag from './bbcode/LineTag';
import LinkTag from './bbcode/LinkTag';
import SizeTag from './bbcode/SizeTag';
import SpoilerTag from './bbcode/SpoilerTag';
import YoutubeTag from './bbcode/YoutubeTag';

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
bbcode.registerTag('font', FontTag);
bbcode.registerTag('youtube', YoutubeTag);
bbcode.registerTag('line', LineTag);

interface IBaseProps {
  t: I18next.TranslationFunction;
  short: string;
  long: string;
}

type IProps = IBaseProps;

const convertDiv = document.createElement('div');
function transformSymbol(fullMatch, symbol: string): string {
  convertDiv.innerHTML = symbol;
  return convertDiv.innerText;
}

class Description extends React.Component<IProps, {}> {
  public render(): JSX.Element {
    const {t, long, short} = this.props;

    const longDecoded = bbcode.toReact(long
      .replace(/<br *\/?>/g, '[br][/br]')
      .replace(/(&[^;]+;)/g, transformSymbol));

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
