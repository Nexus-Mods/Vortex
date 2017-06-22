import * as path from 'path';
import * as React from 'react';

import { remote } from 'electron';

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

const sets: { [setId: string]: IIconFile } = {};

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

function getIcon(set: string, name: string): IRenderDescription {
  if (!(set in sets)) {
    sets[set] = require(path.resolve(remote.app.getAppPath(), 'assets', 'fonts', set + '.json'));
  }

  const icon = sets[set].icons.find((ele: IIconDescription) => ele.icon.tags.indexOf(name) !== -1);
  if (icon !== undefined) {
    const paths: IPath[] = icon.icon.paths.map((path: string, idx: number) => ({
      path,
      attrs: 'attrs' in icon.icon ? convertAttrs(icon.icon.attrs[idx]) : undefined,
    }));

    return {
      paths,
      height: sets[set].height,
      width: icon.icon.width,
    };
  } else {
    return fallback;
  }
}

export interface IIconProps {
  className?: string;
  style?: { [key: string]: string };
  size?: number;
  set?: string;
  name: string;
  spin?: boolean;
  pulse?: boolean;
  border?: boolean;
  inverse?: boolean;
  flip?: 'horizontal' | 'vertical';
  rotate?: number;
}

function renderPath(path: IPath, idx: number) {
  return <path key={idx} d={path.path} style={path.attrs} />;
}

const Icon = (props: IIconProps) => {
  const set = props.set || 'vortex';
  const icon = getIcon(set, props.name);

  let classes = [ 'icon', `icon-${props.name}` ];
  // avoid using css for transforms. For one thing this is more flexible but more importantly
  // it has no interactions with other css. For example css transforms tend to break z ordering
  const transforms = [];

  if (props.spin) {
    classes.push('icon-spin');
  }

  if (props.pulse) {
    classes.push('icon-pulse');
  }

  if (props.border) {
    classes.push('icon-border');
  }

  if (props.flip) {
    transforms.push(props.flip === 'horizontal'
      ? `scale(-1, 1)`
      : `scale(1, -1)`);
  }

  if (props.rotate) {
    transforms.push(`rotate(${props.rotate}, ${icon.width / 2}, ${icon.height / 2})`);
  }

  if (props.className !== undefined) {
    classes = classes.concat(props.className.split(' '));
  }

  const id = `icon-${props.name}`;

  return (
    <svg
      preserveAspectRatio='xMidYMid meet'
      className={ classes.join(' ') }
      viewBox={ `0 0 ${ icon.width } ${ icon.height }` }
      style={ props.style }
    >
      <defs>
        <symbol id={id} width={icon.width} height={icon.height}>
          { icon.paths.map(renderPath) }
        </symbol>
      </defs>
      <use xlinkHref={'#' + id} transform={ transforms.join(' ') } />
    </svg>
  );
};

export default Icon;
