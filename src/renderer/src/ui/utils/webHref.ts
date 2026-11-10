/**
 * A link's target, if it's a web page: an absolute http or https URL. Anything else, such as a
 * file, network path or custom protocol, could run something once opened, so it's undefined.
 */
export const webHref = (href: string | undefined): string | undefined => {
  if (href === undefined || !URL.canParse(href)) {
    return undefined;
  }

  const { protocol } = new URL(href);
  return ["http:", "https:"].includes(protocol) ? href : undefined;
};
