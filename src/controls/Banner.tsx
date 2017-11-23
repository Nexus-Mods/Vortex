import { IBannerOptions } from '../types/IBannerOptions';
import { connect } from '../util/ComponentEx';
import { extend, IExtensibleProps } from '../util/ExtensionProvider';

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
  [bannerIdx: number]: {
    [key: string]: any,
  };
}

type IProps = IBaseProps & IExtensionProps & React.HTMLAttributes<any>;

class Banner extends React.Component<IProps, {}> {
  private mRef: Element;
  private mBanners: IBannerDefinition[];
  private mCurrentBanner: number = 0;

  public componentWillMount() {
    setInterval(this.cycle, this.props.cycleTime || 15000);
  }

  public render(): JSX.Element {
    const { className, objects, style } = this.props;

    this.mBanners = objects.filter((obj, idx) =>
      (obj.options.condition === undefined) || obj.options.condition(this.props[idx]));

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
    if (this.mRef !== null) {
      this.mRef.childNodes.item(this.mCurrentBanner).attributes.removeNamedItem('class');
      this.mCurrentBanner = (this.mCurrentBanner + 1) % this.mBanners.length;
      const attr = document.createAttribute('class');
      attr.value = 'active';
      this.mRef.childNodes.item(this.mCurrentBanner).attributes.setNamedItem(attr);
    }
  }
}

function registerBanner(instanceProps: IBaseProps,
                        group: string,
                        component: React.ComponentClass<any>,
                        options: IBannerOptions,
                        ): IBannerDefinition {
  if (instanceProps.group === group) {
    return { component, options };
  } else {
    return undefined;
  }
}

export type ExportType = IBaseProps & IExtensibleProps & React.HTMLAttributes<any> & any;

function mapStateToProps(state: any, ownProps: IProps): IConnectedProps {
  return (ownProps.objects || []).reduce((prev: any, banner: IBannerDefinition, idx: number) => {
    const props = banner.options.props;
    if (props !== undefined) {
      prev[idx] = Object.keys(props).reduce((propsPrev: any, key: string) => {
        propsPrev[key] = props[key](state);
        return propsPrev;
      }, {});
    }
    return prev;
  }, {});
}

export default
  extend(registerBanner)(
    connect(mapStateToProps)(
      Banner as any)) as React.ComponentClass<ExportType>;
