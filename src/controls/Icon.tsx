import { log } from '../util/log';
import IconBase from './Icon.base';

import Bluebird from 'bluebird';
// using fs directly because the svg may be bundled inside the asar so
// we need the electron-fs hook here
import * as fs from 'fs';
import update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import getVortexPath from '../util/getVortexPath';

export interface IIconProps {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  set?: string;
  name: string;
  spin?: boolean;
  pulse?: boolean;
  stroke?: boolean;
  hollow?: boolean;
  border?: boolean;
  flip?: 'horizontal' | 'vertical';
  rotate?: number;
  rotateId?: string;
  // avoid using this! These styles may affect other instances of this icon
  svgStyle?: string;
  onContextMenu?: React.MouseEventHandler<Icon>;
}

export function installIconSet(set: string, setPath: string): Bluebird<Set<string>> {
  const newset = document.createElement('div');
  newset.id = 'iconset-' + set;
  document.getElementById('icon-sets').appendChild(newset);
  log('info', 'read font', setPath);
  return new Bluebird((resolve, reject) => {
    fs.readFile(setPath, {}, (err, data) => {
      if (err !== null) {
        return reject(err);
      }
      return resolve(data);
    });
  })
    .then(data => {
      newset.innerHTML = data.toString();
      const newSymbols = newset.querySelectorAll('symbol');
      const newSet = new Set<string>();
      newSymbols.forEach(ele => {
        newSet.add(ele.id);
      });
      return newSet;
    });
}

const loadingIconSets = new Set<string>();

class Icon extends React.Component<IIconProps, { sets: { [setId: string]: Set<string> } }> {
  private mLoadPromise: Bluebird<any>;
  private mMounted: boolean = false;

  constructor(props: IIconProps) {
    super(props);

    this.state = {
      sets: {},
    };
  }

  public componentDidMount() {
    this.mMounted = true;
  }

  public componentWillUnmount() {
    this.mMounted = false;
    if (this.mLoadPromise !== undefined) {
      this.mLoadPromise.cancel();
    }
  }

  public render(): JSX.Element {
    return <IconBase {...this.props} getSet={this.loadSet} />;
  }

  private loadSet = (set: string): Bluebird<Set<string>> => {
    const { sets } = this.state;
    if ((sets[set] === undefined) && !loadingIconSets.has(set)) {
      { // mark the set as being loaded
        const copy = { ...sets };
        copy[set] = null;

        loadingIconSets.add(set);
        if (this.mMounted) {
          this.setState(update(this.state, { sets: { $set: copy } }));
        }
      }

      // different extensions don't share the sets global so check in the dom
      // to see if the iconset is already loaded after all
      const existing = document.getElementById('iconset-' + set);

      if (existing !== null) {
        const newSymbols = existing.querySelectorAll('symbol');
        const newSet = new Set<string>();
        newSymbols.forEach(ele => {
          newSet.add(ele.id);
        });
        this.mLoadPromise = Bluebird.resolve(newSet);
      } else {
        // make sure that no other icon instance tries to render this icon
        const fontPath = path.resolve(getVortexPath('assets'), 'fonts', set + '.svg');
        this.mLoadPromise = installIconSet(set, fontPath);
      }

      return this.mLoadPromise.then((newSet: Set<string>) => {
        this.mLoadPromise = undefined;
        // need to copy the _current_ sets because for all we know another load might have completed
        // in the meantime
        const copy = { ...this.state.sets };
        copy[set] = newSet;
        loadingIconSets.delete(set);
        if (this.mMounted) {
          this.setState(update(this.state, { sets: { $set: copy } }));
        }
        return newSet;
      });
    } else {
      return Bluebird.resolve(sets[set] || null);
    }
  }
}

export default Icon;
