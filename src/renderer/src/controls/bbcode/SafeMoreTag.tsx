import MoreTag from "./MoreTag";

/** A `[more]` popover for bbcode we don't write ourselves, showing only Nexus Mods images. */
class SafeMoreTag extends MoreTag {
  protected readonly safe: boolean = true;
}

export default SafeMoreTag;
