import {ITableAttribute} from '../../types/ITableAttribute';
import { ComponentEx } from '../../util/ComponentEx';
import { getCurrentLanguage } from '../../util/i18n';
import relativeTime from '../../util/relativeTime';
import { getSafe, setSafe } from '../../util/storeHelper';
import Icon from '../../views/Icon';
import DateTimeFilter from '../../views/table/DateTimeFilter';

import { IModWithState } from './types/IModProps';
import Description from './views/Description';

import * as I18next from 'i18next';
import * as React from 'react';
import { Image, Overlay } from 'react-bootstrap';

interface IImageProps {
  t: I18next.TranslationFunction;
  url: string;
  shortDescription: string;
  longDescription: string;
}

class ImageComponent extends ComponentEx<IImageProps, { showOverlay: boolean }> {
  private mRef: HTMLElement;

  constructor(props) {
    super(props);
    this.state = {
      showOverlay: false,
    };
  }

  public render(): JSX.Element {
    const { t, longDescription, shortDescription, url } = this.props;
    const { showOverlay } = this.state;

    return (
      <div className='mod-picture-container' ref={this.setRef}>
        { (url !== undefined)
          ? <Image className='mod-picture' src={url} onClick={this.toggleOverlay} />
          : <Icon name='image' />
        }
        <Overlay
          show={showOverlay}
          onHide={this.toggleOverlay}
          placement='left'
          target={this.mRef as any}
          container={this.context.menuLayer}
          rootClose={true}
        >
          <Image src={url} className='mod-picture-large' onClick={this.toggleOverlay} />
        </Overlay>
        <Description
          t={t}
          long={longDescription}
          short={shortDescription}
        />
      </div>
    );
  }

  private setRef = ref => {
    this.mRef = ref;
  }

  private toggleOverlay = () => {
    this.setState(setSafe(this.state, ['showOverlay'], !this.state.showOverlay));
  }
}

export const PICTURE: ITableAttribute = {
  id: 'picture',
  description: 'A picture provided by the author',
  customRenderer: (mod: IModWithState, detail: boolean, t: I18next.TranslationFunction) => {
    const long = getSafe(mod.attributes, ['description'], '');
    const short = getSafe(mod.attributes, ['shortDescription'], '');

    const url = getSafe(mod.attributes, ['pictureUrl'], undefined);
    return <ImageComponent t={t} longDescription={long} shortDescription={short} url={url}/>;
  },
  calc: (mod: IModWithState) => getSafe(mod.attributes, ['pictureUrl'], ''),
  placement: 'detail',
  edit: {},
};

export const INSTALL_TIME: ITableAttribute = {
  id: 'installTime',
  name: 'Installation Time',
  description: 'Time when this mod was installed',
  icon: 'calendar-plus-o',
  customRenderer: (mod: IModWithState, detail: boolean, t) => {
    const timeString = getSafe(mod.attributes, ['installTime'], undefined);
    if (detail) {
      const lang = getCurrentLanguage();
      return (
        <p>
          {
            timeString !== undefined
              ? new Date(timeString).toLocaleString(lang)
              : t('Not installed')
          }
        </p>
      );
    } else {
      if (timeString === undefined) {
        return <p>{t('Not installed')}</p>;
      }
      return <p>{ relativeTime(new Date(timeString), t) }</p>;
    }
  },
  calc: (mod: IModWithState) => new Date(getSafe(mod.attributes, ['installTime'], '')),
  placement: 'both',
  isToggleable: true,
  isDefaultVisible: false,
  edit: {},
  isSortable: true,
  filter: new DateTimeFilter(),
};
