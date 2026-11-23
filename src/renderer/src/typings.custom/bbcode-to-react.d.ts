declare namespace BBCodeToReact {
  export class Tag {
    name: string;
    params: any;
    renderer: any;
    /** The text of a text node, which has no name. */
    text: string;
    children: Tag[];
    /** Drops the newline after the tag, for a tag that ends its line. */
    STRIP_OUTER: boolean;

    constructor(renderer, settings);

    getComponents(): React.ReactChild[];
    getContent(raw?: boolean): string;
    toText(contentAsHTML?: boolean): string;
    toHTML(): string[];
    toReact(): React.ReactChild[] | JSX.Element;
  }

  export class Parser {
    registerTag(name: string, tag: any);
    toHTML(input: string): string[];
    toReact(input: string): React.ReactChild[];
  }

  export function registerTag(name: string, tag: any);
  export function toHTML(input: string): string[];
  export function toReact(input: string): React.ReactChild[];
}

declare module "bbcode-to-react" {
  export = BBCodeToReact;
}
