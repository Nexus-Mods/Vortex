import BrTag from './bbcode/BrTag';
import FontTag from './bbcode/FontTag';
import HeadingTag from './bbcode/HeadingTag';
import LineTag from './bbcode/LineTag';
import LinkTag from './bbcode/LinkTag';
import SizeTag from './bbcode/SizeTag';
import SpoilerTag from './bbcode/SpoilerTag';
import SvgTag from './bbcode/SvgTag';
import YoutubeTag from './bbcode/YoutubeTag';

import * as bbcode from 'bbcode-to-react';

bbcode.registerTag('size', SizeTag);
bbcode.registerTag('br', BrTag);
bbcode.registerTag('email', LinkTag);
bbcode.registerTag('link', LinkTag);
bbcode.registerTag('url', LinkTag);
bbcode.registerTag('spoiler', SpoilerTag);
bbcode.registerTag('font', FontTag);
bbcode.registerTag('youtube', YoutubeTag);
bbcode.registerTag('line', LineTag);
bbcode.registerTag('heading', HeadingTag);
bbcode.registerTag('svg', SvgTag);

let convertDiv: HTMLDivElement;

function transformSymbol(fullMatch, symbol: string): string {
  if (convertDiv === undefined) {
    convertDiv = document.createElement('div');
  }
  convertDiv.innerHTML = symbol;
  return convertDiv.innerText;
}

function renderBBCode(input: string): React.ReactChild[] {
  return bbcode.toReact(input.replace(/<br *\/?>/g, '[br][/br]')
      .replace(/(&[^;]+;)/g, transformSymbol));
}

export default renderBBCode;
