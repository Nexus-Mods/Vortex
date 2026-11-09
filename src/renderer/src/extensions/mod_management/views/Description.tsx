import type { TFunction } from "i18next";
import memoizeOne from "memoize-one";
import * as React from "react";
import { Overlay, Popover } from "react-bootstrap";

import { renderSafeBBCode } from "@/controls/bbcode";
import { BBCode } from "@/ui/components/prose/bbcode/BBCode";

import Icon from "../../../controls/Icon";
import { truthy } from "../../../util/util";

interface IBaseProps {
  t: TFunction;
  short: string;
  long: string;
  modId: string;
  source: string;
  installed: boolean;
  /** The mod's page on Nexus Mods, which images from elsewhere point to; without one, they're left out. */
  websiteUrl?: string;
  /** Whether the mod is adult content; blurs its images if the user's set to. */
  isFromAdultContent?: boolean;
  startEditDescription: (modId: string) => void;
}

type IProps = IBaseProps;

interface IComponentState {
  open: boolean;
}

function nop() {
  // nop
}

class Description extends React.Component<IProps, IComponentState> {
  private mRef: Element;

  // Inline in the toggle link, so without the prose wrapper.
  private shortBB = memoizeOne((short: string) => renderSafeBBCode(short));

  // Parsed only when one of these changes, not on every render of the row, such as on a download's
  // progress.
  private longBB = memoizeOne((long: string, websiteUrl?: string, isFromAdultContent?: boolean) => (
    <BBCode
      bbcode={long}
      className="mb-2"
      externalImagePlaceholders={websiteUrl !== undefined ? { websiteUrl } : undefined}
      isFromAdultContent={isFromAdultContent}
      size="sm"
    />
  ));

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { t, installed, isFromAdultContent, long, short, source, websiteUrl } = this.props;

    const popover = (
      <Popover id="popover-mod-description">
        {this.longBB(long || `<${t("No description")}>`, websiteUrl, isFromAdultContent)}
        {truthy(source) ? (
          <a
            onClick={nop}
            className="fake-link-disabled"
            title={t("Description is synchronized with an online source")}
          >
            <Icon name="edit" />
            {t("Edit Description")}
          </a>
        ) : !installed ? (
          <a
            onClick={nop}
            className="fake-link-disabled"
            title={t("Description can only be changed for installed mods")}
          >
            <Icon name="edit" />
            {t("Edit Description")}
          </a>
        ) : (
          <a onClick={this.editDescription}>
            <Icon name="edit" />
            {t("Edit Description")}
          </a>
        )}
      </Popover>
    );

    return (
      <div>
        <Overlay
          rootClose
          placement="left"
          onHide={this.hide}
          show={this.state.open}
          target={this.getRef}
        >
          {popover}
        </Overlay>
        <a data-testid="mod-description-toggle" ref={this.setRef} onClick={this.toggle}>
          {!short ? t("Description") : this.shortBB(short)}
        </a>
      </div>
    );
  }

  private editDescription = () => {
    this.props.startEditDescription(this.props.modId);
  };

  private getRef = () => this.mRef;

  private setRef = (ref) => {
    this.mRef = ref;
  };

  private hide = () => {
    this.setState({ open: false });
  };

  private toggle = () => {
    this.setState({ open: !this.state.open });
  };
}

export default Description;
