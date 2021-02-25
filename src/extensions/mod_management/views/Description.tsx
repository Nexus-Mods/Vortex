import Icon from '../../../controls/Icon';
import bbcode from '../../../util/bbcode';

import { TFunction } from 'i18next';
import memoizeOne from 'memoize-one';
import * as React from 'react';
import { Overlay, Popover } from 'react-bootstrap';

interface IBaseProps {
  t: TFunction;
  short: string;
  long: string;
  modId: string;
  editable: boolean;
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
  private mLongBB: React.ReactChild[];

  private shortBB = memoizeOne((short: string) => bbcode(short));

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { t, editable, short } = this.props;

    const popover = (
      <Popover id='popover-mod-description'>
        <div style={{ maxHeight: 700, overflowY: 'auto' }}>{this.mLongBB}</div>
        {editable
          ? (
            <a onClick={this.editDescription}>
              <Icon name='edit'/>{t('Edit Description')}
            </a>
          ) : (
            <a
              onClick={nop}
              className='fake-link'
              title={t('Description is synchronized with an online source')}
            >
              <Icon name='edit'/>{t('Edit Description')}
            </a>
          )
        }
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

  private editDescription = () => {
    this.props.startEditDescription(this.props.modId);
  }

  private getRef = () => this.mRef;

  private setRef = ref => {
    this.mRef = ref;
  }

  private hide = () => {
    this.setState({ open: false });
  }

  private toggle = () => {
    const { t } = this.props;
    if (!this.state.open) {
      this.mLongBB = bbcode(this.props.long
        || `<${t('No description')}>`);
    }
    this.setState({ open: !this.state.open });
  }
}

export default Description;
