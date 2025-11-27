/**
 * Class to convert the current theme, given as a set of CSS rules, 
 * into an injectable CSS string; to be used with Electron's Webviews.
 */

export class ThemeToCSS {
  public static getCSSInjectString(rules: CSSStyleRule[]): string {
    const variables = this.transformRules(rules);
    // String containing the css code we want to inject into the webview object
    return (`
      html::-webkit-scrollbar {
        display: none;
      }
    `);
  }

  private static transformRules(rules: CSSStyleRule[]): { [id: string]: any } {
    return rules
      .filter(rule => (rule.selectorText !== undefined)
                    && rule.selectorText.startsWith('#variable'))
      .reduce((prev, rule) => {
        const [id, type, key] = rule.selectorText.split(' ');
        prev[key.slice(1)] = rule.style[type.slice(1)];
        return prev;
      }, {});  }
}
