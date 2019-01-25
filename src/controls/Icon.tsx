import { log } from '../util/log';

import * as Promise from 'bluebird';
// using fs directly because the svg may be bundled inside the asar so
// we need the electron-fs hook here
import * as fs from 'fs';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';

const debugMissingIcons = process.env.NODE_ENV === 'development';
const debugReported = new Set<string>();

const sets: { [setId: string]: Set<string> } = {};

export interface IIconProps {
  className?: string;
  style?: React.CSSProperties;
  set?: string;
  name: string;
  spin?: boolean;
  pulse?: boolean;
  stroke?: boolean;
  border?: boolean;
  flip?: 'horizontal' | 'vertical';
  rotate?: number;
  rotateId?: string;
  svgStyle?: string;
}

class Icon extends React.Component<IIconProps, {}> {
  private static sCache: { [id: string]: { width: number, height: number } } = {};
  private mCurrentSize: { width: number, height: number };

  public componentWillMount() {
    this.setIcon(this.props);
  }

  public componentWillReceiveProps(newProps: IIconProps) {
    this.setIcon(newProps);
  }

  public render(): JSX.Element {
    const { name, style, svgStyle } = this.props;

    let classes = ['icon', `icon-${name}`];
    // avoid using css for transforms. For one thing this is more flexible but more importantly
    // it has no interactions with other css. For example css transforms tend to break z ordering
    const transforms = [];

    if (this.props.spin || (name === 'spinner')) {
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
      if (this.mCurrentSize !== undefined) {
        const { width, height } = this.mCurrentSize;
        transforms.push(
          `rotate(${this.props.rotate}, ${Math.floor(width / 2)}, ${Math.floor(height / 2)})`);
      }
    }

    if (this.props.className !== undefined) {
      classes = classes.concat(this.props.className.split(' '));
    }

    return (
      <svg
        preserveAspectRatio='xMidYMid meet'
        className={classes.join(' ')}
        style={style}
        ref={this.props.rotate && (this.mCurrentSize === undefined) ? this.setRef : undefined}
      >
        {svgStyle !== undefined ? <style type='text/css'>{svgStyle}</style> : null}
        <use xlinkHref={`#icon-${name}`} transform={transforms.join(' ')} />
      </svg>
    );
  }

  private setRef = (ref: Element) => {
    if (ref !== null) {
      const { width, height } = ref.getBoundingClientRect();
      this.mCurrentSize = { width, height };
      this.forceUpdate();
      if (this.props.rotateId !== undefined) {
        Icon.sCache[this.props.rotateId] = this.mCurrentSize;
      }
    }
  }

  private setIcon(props: IIconProps) {
    const set = props.set || 'icons';
    this.loadSet(set)
    .then(() => {
      if (debugMissingIcons
          && (sets[set] !== null)
          && !sets[set].has('icon-' + props.name)
          && !debugReported.has(props.name)) {
        // tslint:disable-next-line:no-console
        console.trace('icon missing', props.name);
        debugReported.add(props.name);
      }
    });

    if (props.rotate && (props.rotateId !== undefined) && (this.mCurrentSize === undefined)) {
      this.mCurrentSize = Icon.sCache[props.rotateId];
    }
  }

  private loadSet(set: string): Promise<void> {
    if (sets[set] === undefined) {
      sets[set] = null;
      // different extensions don't share the sets global so check in the dom
      // to see if the iconset is already loaded after all
      const existing = document.getElementById('iconset-' + set);
      if (existing !== null) {
        const newSymbols = existing.querySelectorAll('symbol');
        sets[set] = new Set<string>();
        newSymbols.forEach(ele => {
          sets[set].add(ele.id);
        });
        return Promise.resolve();
      }

      // make sure that no other icon instance tries to render this icon
      const newset = document.createElement('div');
      newset.id = 'iconset-' + set;
      document.getElementById('icon-sets').appendChild(newset);

      const fontPath = path.resolve(remote.app.getAppPath(), 'assets', 'fonts', set + '.svg');
      log('info', 'read font', fontPath);
      // TODO: this does not support adding icons from extensions yet
      return new Promise((resolve, reject) => {
        fs.readFile(fontPath, {}, (err, data) => {
          if (err !== null) {
            return reject(err);
          }
          return resolve(data);
        });
      })
        .then(data => {
          newset.innerHTML = data.toString();
          const newSymbols = newset.querySelectorAll('symbol');
          sets[set] = new Set<string>();
          newSymbols.forEach(ele => {
            sets[set].add(ele.id);
          });
        });
    } else {
      return Promise.resolve();
    }
  }
}

export default Icon;
