import Icon from './Icon';
import Overlay from './Overlay';
import { IconButton } from './TooltipControls';
import { IExtensionApi } from '../types/api';
import { translate, ComponentEx } from '../util/ComponentEx';

import * as React from 'react';
import {Popover} from 'react-bootstrap';

let _haveKnowledgeBase: boolean;

function haveKnowledgeBase(api: IExtensionApi): boolean {
  if (_haveKnowledgeBase === undefined) {
    // is this expensive? Is it worth caching?
    _haveKnowledgeBase = api.events.listenerCount('open-knowledge-base') > 0;
  }
  return _haveKnowledgeBase;
}

export interface IProps {
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
        <div className='more-footer'><a href={`#${wikiId}`} onClick={this.openWiki}>
          <Icon name='open-in-browser'/>{' '}{t('Learn more')}</a>
        </div>
      );

    let pCounter = 0;
    const popover = (
      <Popover id={`popover-${id}`} className='more-popover' title={name}>
        {children.split('\n\n').map((paragraph) => <p key={pCounter++}>{paragraph}</p>)}
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
    this.context.api.events.emit('open-knowledge-base', evt.currentTarget.getAttribute('href').slice(1));
    this.hide();
  }

  private toggle = evt => {
    evt.preventDefault();
    this.setState({ open: !this.state.open });
  }

  private hide = () => {
    this.setState({ open: false });
  }

  private getBounds = (): ClientRect => {
    const { container } = this.props;

    return container !== undefined ? container.getBoundingClientRect() : {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };
  }
}

export default translate(['common'], { wait: false })(More) as React.ComponentClass<IProps>;
