import bbcode from '../../../util/bbcode';

import { TFunction } from 'i18next';
import memoizeOne from 'memoize-one';
import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';

interface IBaseProps {
  t: TFunction;
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

  private shortBB = memoizeOne((short: string) => bbcode(short));

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { t, long, short } = this.props;

    if (!long && !short) {
      return <div>{t('No description')}</div>;
    }

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
        <a ref={this.setRef} onClick={this.toggle}>
          {!short ? t('Description') : this.shortBB(short)}
        </a>
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
