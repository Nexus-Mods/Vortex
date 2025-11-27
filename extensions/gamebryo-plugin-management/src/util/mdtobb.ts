import parse, { Node } from 'markdown-ast';

function astToBBCode(input: Node): string {
  const rec = () => {
    if (input['block'] !== undefined) {
      return input['block'].map(astToBBCode).join('');
    } else {
      throw new Error('expected node of type Block');
    }
  };

  switch (input.type) {
    case 'bold': return `[b]${rec()}[/b]`;
    case 'border': return input.text;
    case 'break': return '[br][br/]';
    case 'codeBlock': return `[code]${input.code}[/code]`;
    case 'codeSpan': return `[code]${input.code}[/code]`;
    case 'image': return `[img]${input.url}[/img]`;
    case 'italic': return `[i]${rec()}[/i]`;
    case 'link': return `[url=${input.url}]${rec()}[/url]`;
    case 'linkDef': return `[url]${input.url}[/url]`;
    case 'list': return `[ul]${rec()}[/ul]`;
    case 'quote': return `[quote]${rec()}[/quote]`;
    case 'strike': return `[s]${rec()}[/s]`;
    case 'text': return input.text;
    case 'title': return `[b]${rec()}[/b]`;
    default: return '';
  }
}

export function markdownToBBCode(input: string): string {
  const ast = parse(input);

  return ast.map(astToBBCode).join();
}
