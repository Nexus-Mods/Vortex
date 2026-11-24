import SizeTag from "./SizeTag";

/** The site's sizes as a browser draws them, against size 3, the text's own. */
const SIZES: Record<number, number> = { 1: 0.625, 2: 0.8125, 3: 1, 4: 1.125, 5: 1.5, 6: 2 };

/** The site's older percentage sizes, as the sizes it now draws them at. */
const PERCENTAGES: Record<number, number> = { 50: 1, 85: 2, 100: 3, 150: 4, 200: 6 };

/** A size for bbcode we don't write ourselves, scaled as the site scales it; others don't scale. */
class SafeSizeTag extends SizeTag {
  protected calc(size: number): string {
    const scale = SIZES[PERCENTAGES[size] ?? size] ?? 1;

    return `${scale}em`;
  }
}

export default SafeSizeTag;
