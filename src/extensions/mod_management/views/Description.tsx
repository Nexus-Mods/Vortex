import bbcode from '../../../util/bbcode';

import * as I18next from 'i18next';
import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';

interface IBaseProps {
  t: I18next.TranslationFunction;
  short: string;
  long: string;
}

type IProps = IBaseProps;

interface IComponentState {
  open: boolean;
}

class Description extends React.Component<IProps, IComponentState> {
  private mRef: Element;
  private mLongBB: React.ReactChild[];
  private mShortBB: React.ReactChild[];

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public componentWillMount() {
    const { long, short } = this.props;
    this.mShortBB = bbcode(short);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.props.short !== newProps.short) {
      this.mShortBB = bbcode(newProps.short);
    }
  }

  public render(): JSX.Element {
    const {t, long, short} = this.props;

    const popover = (
      <Popover id='popover-mod-description'>
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>{this.mLongBB}</div>
      </Popover>
    );

    return (
      <div>
        <Overlay
          rootClose
          placement='left'
          onHide={this.hide}
          show={this.state.open}
          target={this.getRef}
        >
          {popover}
        </Overlay>
        <a ref={this.setRef} onClick={this.toggle}>{this.mShortBB}</a>
      </div>
    );
  }

  private getRef = () => this.mRef;

  private setRef = ref => {
    this.mRef = ref;
  }

  private hide = () => {
    this.setState({ open: false });
  }

  private toggle = () => {
    if (!this.state.open) {
      this.mLongBB = bbcode(this.props.long);
    }
    this.setState({ open: !this.state.open });
  }
}

export default Description;
