import SizeTag from "./SizeTag";

const MIN_SIZE = 0;
const MAX_SIZE = 6;

/** A size for bbcode we don't write ourselves, capped so it can't blow its text up past the dialog. */
class SafeSizeTag extends SizeTag {
  protected calc(sizeFactor: number): string {
    return super.calc(Math.min(Math.max(sizeFactor, MIN_SIZE), MAX_SIZE));
  }
}

export default SafeSizeTag;
