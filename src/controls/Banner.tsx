import { IBannerOptions } from '../types/IBannerOptions';
import { IExtensibleProps } from '../types/IExtensionProvider';
import { connect } from '../util/ComponentEx';
import { extend } from '../util/ExtensionProvider';
import { truthy } from '../util/util';

import * as _ from 'lodash';
import * as React from 'react';
import { setInterval } from 'timers';

interface IBannerDefinition {
  component: React.ComponentClass<any>;
  options: IBannerOptions;
}

export interface IBaseProps {
  group: string;
  cycleTime?: number;
}

interface IExtensionProps {
  objects: IBannerDefinition[];
}

interface IConnectedProps {
  bannerProps: {
    [bannerIdx: number]: {
      [key: string]: any,
    };
  };
}

type IProps = IBaseProps & IConnectedProps & IExtensionProps & React.HTMLAttributes<any>;

class Banner extends React.Component<IProps, {}> {
  private mRef: Element;
  private mBanners: IBannerDefinition[];
  private mCurrentBanner: number = 0;

  public componentDidMount() {
    setInterval(this.cycle, this.props.cycleTime || 15000);
  }

  public render(): JSX.Element {
    const { bannerProps, className, objects, style } = this.props;

    this.mBanners = objects.filter((obj, idx) =>
      (obj.options.condition === undefined) || obj.options.condition(bannerProps[idx]));

    const classes = className !== undefined ? className.split(' ') : [];
    classes.push('banner');

    return (this.mBanners.length > 0) ? (
      <div className={classes.join(' ')} style={style} ref={this.setRef}>
        {this.mBanners.map(this.renderBanner)}
      </div>
    ) : null;
  }

  private renderBanner = (banner: IBannerDefinition, idx: number) => {
    return (
      <div key={idx} className={idx === this.mCurrentBanner ? 'active' : undefined}>
        <banner.component />
      </div>
    );
  }

  private setRef = ref => {
    this.mRef = ref;
  }

  private cycle = () => {
    if (truthy(this.mRef)) {
      (this.mRef.childNodes.item(this.mCurrentBanner) as any).attributes.removeNamedItem('class');
      this.mCurrentBanner = (this.mCurrentBanner + 1) % this.mBanners.length;
      const attr = document.createAttribute('class');
      attr.value = 'active';
      (this.mRef.childNodes.item(this.mCurrentBanner) as any).attributes.setNamedItem(attr);
    }
  }
}

function registerBanner(instanceGroup: string,
                        group: string,
                        component: React.ComponentClass<any>,
                        options: IBannerOptions,
                        ): IBannerDefinition {
  if (instanceGroup === group) {
    return { component, options };
  } else {
    return undefined;
  }
}

export type ExportType = IBaseProps & IExtensibleProps & React.HTMLAttributes<any> & any;

let lastBannerProps: { [idx: number]: any };

function mapStateToProps(state: any, ownProps: IProps): IConnectedProps {
  const bannerProps = (ownProps.objects || []).reduce(
    (prev: any, banner: IBannerDefinition, idx: number) => {
      const props = banner.options.props;
      if (props !== undefined) {
        prev[idx] = Object.keys(props).reduce((propsPrev: any, key: string) => {
          propsPrev[key] = props[key](state);
          return propsPrev;
        }, {});
      }
      return prev;
  }, {});
  if (!_.isEqual(lastBannerProps, bannerProps)) {
    lastBannerProps = bannerProps;
  }
  return {
    bannerProps: lastBannerProps,
  };
}

export default
  extend(registerBanner, 'group')(
    connect(mapStateToProps)(
      Banner) as any) as React.ComponentClass<ExportType>;
