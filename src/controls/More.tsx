import { IExtensionApi } from '../types/api';
import { ComponentEx, translate } from '../util/ComponentEx';

import Icon from './Icon';
import Overlay from './Overlay';
import { IconButton } from './TooltipControls';

import * as React from 'react';
import {Popover} from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

const haveKnowledgeBase = (() => {
  let value: boolean;

  return (api: IExtensionApi): boolean => {
    if (value === undefined) {
      // is this expensive? Is it worth caching?
      value = api.events.listenerCount('open-knowledge-base') > 0;
    }
    return value;
  };
})();

export interface IMoreProps {
  id: string;
  name: string;
  wikiId?: string;
  children?: string;
  container?: Element;
  orientation?: 'vertical' | 'horizontal';
}

export interface IComponentState {
  open: boolean;
}

type IProps = IMoreProps & WithTranslation;

/**
 * Component to make additional information available to the user without taking much
 * space. The user only sees a clickable question mark. On click it will show a popover
 * with the info.
 *
 * double-linebreaks can be used in the text to start a new paragraph.
 *
 * @param {IProps} props
 * @returns
 */
class More extends ComponentEx<IProps, IComponentState> {

  private mRef: Element;

  constructor(props: IProps) {
    super(props);

    this.state = {
      open: false,
    };
  }

  public render(): JSX.Element {
    const { t, children, id, name, orientation, wikiId } = this.props;
    const { open } = this.state;

    if (children === undefined) {
      return null;
    }

    const wikiFooter = (wikiId === undefined) || !haveKnowledgeBase(this.context.api)
      ? null
      : (
        <div className='more-footer'>
          <a href={`#${wikiId}`} onClick={this.openWiki}>
            {t('Learn more')}
          </a>
        </div>
      );

    let pCounter = 0;
    const popover = (
      <Popover id={`popover-${id}`} className='more-popover' title={name}>
        
        <ReactMarkdown>
          {children}
        </ReactMarkdown>
        {wikiFooter}
      </Popover>
    );
    return (
      <div style={{ display: 'inline' }}>
        <Overlay
          rootClose
          show={open}
          onHide={this.hide}
          orientation={orientation}
          target={this.getRef}
          getBounds={this.getBounds}
        >
          {popover}
        </Overlay>
        <div className='more-link' ref={this.setRef}>
          <IconButton tooltip='' onClick={this.toggle} icon='details' />
        </div>
      </div>
    );
  }

  private getRef = () => this.mRef;

  private setRef = ref => {
    this.mRef = ref;
  }

  private openWiki = (evt: React.MouseEvent<HTMLAnchorElement>) => {
    this.context.api.events.emit('open-knowledge-base',
                                 evt.currentTarget.getAttribute('href').slice(1));
    this.hide();
  }

  private toggle = evt => {
    evt.preventDefault();
    this.setState({ open: !this.state.open });
  }

  private hide = () => {
    this.setState({ open: false });
  }

  private getBounds = (): DOMRect => {
    const { container } = this.props;

    return container !== undefined ? container.getBoundingClientRect() : {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      right: window.innerWidth,
      bottom: window.innerHeight,
    } as any;
  }
}

export default translate(['common'])(React.memo(More)) as React.ComponentClass<IMoreProps>;
