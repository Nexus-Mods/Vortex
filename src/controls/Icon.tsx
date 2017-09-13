import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';

interface IAttr {
  [key: string]: string;
}

interface IIconDescription {
  icon: {
    paths: string[];
    width: number;
    attrs: IAttr[];
    tags: string[];
    isMulticolor?: boolean;
  };
  properties: {
    name: string,
  };
}

interface IIconFile {
  icons: IIconDescription[];
  height: number;
}

interface IAttrMap {
  [key: string]: string;
}

interface IPath {
  path: string;
  attrs?: IAttrMap;
}

interface IRenderDescription {
  paths: IPath[];
  height: number;
  width: number;
}

const sets: { [setId: string]: Set<string> } = {};

// a fallback icon (questionmark from fontawesome)
const fallback = {
  paths: [{
    path: 'M402.286 717.714v137.143q0 9.143-6.857 16t-16 6.857h-137.143q-9.143 \
           0-16-6.857t-6.857-16v-137.143q0-9.143 6.857-16t16-6.857h137.143q9.143 0 16 6.857t6.857 \
           16zM582.857 374.857q0 30.857-8.857 57.714t-20 43.714-31.429 34-32.857 24.857-34.857 \
           20.286q-23.429 13.143-39.143 37.143t-15.714 38.286q0 9.714-6.857 18.571t-16 \
           8.857h-137.143q-8.571 0-14.571-10.571t-6-21.429v-25.714q0-47.429 \
           37.143-89.429t81.714-62q33.714-15.429 \
           48-32t14.286-43.429q0-24-26.571-42.286t-61.429-18.286q-37.143 0-61.714 16.571-20 \
           14.286-61.143 65.714-7.429 9.143-17.714 9.143-6.857 \
           0-14.286-4.571l-93.714-71.429q-7.429-5.714-8.857-14.286t3.143-16q91.429-152 265.143-152 \
           45.714 0 92 17.714t83.429 47.429 60.571 72.857 23.429 90.571z',
    attrs: { fill: '#ff00ff' },
  }],
  width: 636.5749053955078,
  height: 1024,
};

function convertAttrKey(key: string): string {
  return key.replace(/-([a-z])/g, (m, $1: string) => {
    return $1.toUpperCase();
  });
}

function convertAttrs(attrs: IAttrMap): IAttrMap {
  return Object.keys(attrs).reduce((prev: IAttrMap, key: string) => {
    prev[convertAttrKey(key)] = attrs[key];
    return prev;
  }, {});
}

export interface IIconProps {
  className?: string;
  style?: { [key: string]: string };
  size?: number;
  set?: string;
  name: string;
  spin?: boolean;
  pulse?: boolean;
  stroke?: boolean;
  border?: boolean;
  inverse?: boolean;
  flip?: 'horizontal' | 'vertical';
  rotate?: number;
  svgStyle?: string;
}

function renderPath(pathComp: IPath, idx: number) {
  return <path key={idx} d={pathComp.path} style={pathComp.attrs} />;
}

class Icon extends React.Component<IIconProps, {}> {
  private mRef: Element;
  private mCurrentSize: { width: number, height: number };
  private mTicks: number = 0;

  public componentWillMount() {
    this.setIcon(this.props);
  }

  public componentWillReceiveProps(newProps: IIconProps) {
    this.setIcon(newProps);
  }

  public render(): JSX.Element {
    const { name, style, svgStyle } = this.props;
    const set = this.props.set || 'vortex';

    let classes = ['icon', `icon-${name}`];
    // avoid using css for transforms. For one thing this is more flexible but more importantly
    // it has no interactions with other css. For example css transforms tend to break z ordering
    const transforms = [];

    if (this.props.spin) {
      classes.push('icon-spin');
    }

    if (this.props.pulse) {
      classes.push('icon-pulse');
    }

    if (this.props.border) {
      classes.push('icon-border');
    }

    if (this.props.stroke) {
      classes.push('icon-stroke');
    }

    if (this.props.flip) {
      transforms.push(this.props.flip === 'horizontal'
        ? `scale(-1, 1)`
        : `scale(1, -1)`);
    }

    if (this.props.rotate) {
      // narf... I can't use css transform for the rotation because that somehow
      // messes up the z-ordering of items.
      // with svg transforms we have to provide the center of rotation ourselves
      // and we can't use relative units.
      if (this.mRef !== undefined) {
        const { width, height } = this.mCurrentSize;
        transforms.push(
          `rotate(${this.props.rotate}, ${Math.floor(width / 2)}, ${Math.floor(height / 2)})`);
      }
    }

    if (this.props.className !== undefined) {
      classes = classes.concat(this.props.className.split(' '));
    }

    const id = `icon-${name}`;

    return (
      <svg
        preserveAspectRatio='xMidYMid meet'
        className={classes.join(' ')}
        style={style}
        ref={this.setRef}
      >
        {svgStyle !== undefined ? <style type='text/css'>{svgStyle}</style> : null}
        <use xlinkHref={'#' + id} transform={transforms.join(' ')} />
      </svg>
    );
  }

  private setRef = (ref: Element) => {
    if (ref !== null) {
      this.mRef = ref;
      const { width, height } = ref.getBoundingClientRect();
      this.mCurrentSize = { width, height };
      this.forceUpdate();
    }
  }

  private setIcon(props: IIconProps) {
    const set = props.set || 'vortex';

    if (sets[set] === undefined) {
      // different extensions don't share the sets global so check in the dom
      // to see if the iconset is already loaded after all
      const existing = document.getElementById('iconset-' + set);
      if (existing !== null) {
        sets[set] = null;
        return;
      }

      // make sure that no other icon instance tries to render this icon
      const newset = document.createElement('div');
      newset.id = 'iconset-' + set;
      document.getElementById('icon-sets').appendChild(newset);

      // TODO: this does not support adding icons from extensions yet
      fs.readFileAsync(
        path.resolve(remote.app.getAppPath(), 'assets', 'fonts', set + '.svg'))
        .then(data => {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(data.toString(), 'text/xml');
          const ids = Array.from(xmlDoc.getElementsByTagName('symbol'))
            .map(ele => ele.getAttribute('id'));

          newset.innerHTML = data.toString();
          sets[set] = new Set<string>(ids);
        });
    }
  }
}

export default Icon;
