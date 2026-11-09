import type { TFunction } from "i18next";
import memoizeOne from "memoize-one";
import * as React from "react";
import { Overlay, Popover } from "react-bootstrap";

import { renderSafeBBCode } from "../../../controls/bbcode";
import Icon from "../../../controls/Icon";
import { BBCode } from "../../../ui/components/prose/bbcode/BBCode";
import { truthy } from "../../../util/util";

interface IBaseProps {
  t: TFunction;
  short: string;
  long: string;
  modId: string;
  source: string;
  installed: boolean;
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

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { t, installed, long, short, source } = this.props;

    const popover = (
      <Popover id="popover-mod-description">
        <BBCode bbcode={long || `<${t("No description")}>`} size="sm" />
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
