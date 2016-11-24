import * as React from 'react';

import * as path from 'path';

import * as fs from 'fs';

import * as nbind from 'nbind';

import * as async from 'async';

import { log } from '../../../util/log';

import { remote } from 'electron';
import { Component } from 'react';

// import { Panel, Popover, OverlayTrigger, Button } from 'react-bootstrap';

import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';

import { connect } from 'react-redux';

import { loadSavegame } from 'gamebryo-savegame';

// import { Fontawesome } from 'react-fontawesome';

import { Fixed, Flex, Layout } from 'react-layout-pane';

import Sidebar from 'react-sidebar';

const update = require('react-addons-update');

class Dimensions {
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  private fromJS(output: Function) {
    output(this.width, this.height);
  }
}

interface ISavegameProps {
  game: string;
  language: string;
}

interface ISavegameState {
  saves: any[];
  displayed_game: string;
  show: boolean;
}


let saves = undefined;


class SavegamesBase extends Component<ISavegameProps, ISavegameState> {
  private screenshotCanvas: HTMLCanvasElement;

  constructor() {
    super();
    this.state = {
      saves: [],
      displayed_game: undefined,
      show: false,
    }
  }

  public render(): JSX.Element {
    let sidebar = (<canvas ref={(c) => this.screenshotCanvas = c} id="screenshot-canvas" width="0" height="0" />)

    return (
      <Sidebar sidebar={sidebar} open={true} onSetOpen={(open) => { this.setState(update(this.state, { show: { $set: open } })) } }
        pullRight={true} docked={true} shadow={false}>
        <Layout type="row">
          <Flex>
            <BootstrapTable data={this.state.saves} striped={true} hover={true}
              selectRow={{ mode: "checkbox", clickToSelect: true, onSelect: (row, isSelected, event): boolean => this.saveSelected(row, isSelected, event) }}>
              <TableHeaderColumn dataField="fileName" isKey={true} hidden={true} >
                FileName
                            </TableHeaderColumn>
              <TableHeaderColumn dataField="saveNumber" dataSort={true} searchable={false}>
                Save ID
                            </TableHeaderColumn>
              <TableHeaderColumn dataField="characterName" dataSort={true}
                filter={{ type: 'TextFilter', delay: 500, numberComparators: [] }} >
                Name
                            </TableHeaderColumn>
              <TableHeaderColumn dataField="characterLevel" dataSort={true} editable={false}
                filter={{ type: 'TextFilter', delay: 500, numberComparators: [] }} >
                Level
                            </TableHeaderColumn>
              <TableHeaderColumn dataField="location" dataSort={true} editable={false}
                filter={{ type: 'TextFilter', delay: 500, numberComparators: [] }} >
                Location
                            </TableHeaderColumn>
              <TableHeaderColumn dataField="creationTime" dataSort={true} editable={false}
                dataFormat={(data) => this.timestampFormat(data)}>
                Creation Time
                            </TableHeaderColumn>
            </BootstrapTable>
          </Flex>
          <Fixed>
          </Fixed>
        </Layout>
      </Sidebar>
    )
  }

  private searchPath(game: string): string {
    return path.join(remote.app.getPath('documents'), 'my games', game, 'saves');
  }

  private updateSaves(game: string) {
    this.setState(update(this.state, {
      saves: { $set: [] },
      displayed_game: { $set: game },
    }));
    let path: string = this.searchPath(game);

    log('info', 'load saves from', path);

    let files = fs.readdirSync(path);
    this.loadSaveGames(null, path, files);

    //fs.readdir(path, (err, files: string[]) => this.loadSaveGames(err, path, files));
  }

  private timestampFormat(timestamp: number) {
    let date: Date = new Date(timestamp * 1000);
    return date.toLocaleDateString(this.props.language);
  }

  private loadSaveGame(file: string, cb: Function) {
    if (['.ess', '.fos'].indexOf(path.extname(file)) === -1) {
      cb(null, null);
      return;
    }

    try{
    let test = loadSavegame(cb, file);
    let realpath = path.join(window.__dirname, 'savegames.node');
    let binding = nbind.init(realpath);

    saves = binding.lib;

    binding.bind('Dimensions', Dimensions);


    let sg = new saves.GamebryoSaveGame(file);

    cb(null, sg);
    } catch (err) {
      console.log(err);
    }

  }

  private loadSaveGames(err: NodeJS.ErrnoException, basePath: string, files: string[]) {
    if (err !== null) {
      console.error(err);
      return;
    }

    let newSaves = [];
    let counter = 0;

    async.map(
      files,
      (file: string, cb: Function) => this.loadSaveGame(path.join(basePath, file), cb),
      (err, result: any[]) => {
        result = result.filter((x) => x != null);
        if (err !== null) {
          console.error(err);
          return;
        }

        if (result.length > 0) {
          let dim: Dimensions = result[0].screenshotSize;

          this.screenshotCanvas.setAttribute('width', dim.width.toString());
          this.screenshotCanvas.setAttribute('height', dim.height.toString());
        }
        this.setState(update(this.state, {
          saves: { $push: result },
        }));
      }
    );
  }

  private setScreenshot(dim: Dimensions, row) {
    let ctx: CanvasRenderingContext2D = this.screenshotCanvas.getContext('2d');
    let imgData: ImageData = ctx.createImageData(dim.width, dim.height);
    row.screenshot(imgData.data);

    ctx.putImageData(imgData, 0, 0);
  }

  private saveSelected(row, isSelected, event): boolean {
    let dim: Dimensions = row.screenshotSize;

    if (dim.width.toString() !== this.screenshotCanvas.getAttribute('width')) {
      this.screenshotCanvas.setAttribute('width', dim.width.toString());
    }
    if (dim.height.toString() !== this.screenshotCanvas.getAttribute('height')) {
      this.screenshotCanvas.setAttribute('height', dim.height.toString());
    }

    this.setScreenshot(dim, row);
    this.setState(update(this.state, { show: { $set: isSelected } }));

    return true;
  }

  private componentWillMount() {
    if (this.props.game !== undefined) {
      this.updateSaves(this.props.game);
    }
  }

  private componentWillReceiveProps(newProps: ISavegameProps) {
    if (this.state.displayed_game !== newProps.game) {
      this.updateSaves(newProps.game);
    }
  };
}

function mapStateToProps(state: any) {
  return {
    game: state.settings.gameMode.current,
    language: state.settings.interface.language,
  };
}


let Savegames = connect(mapStateToProps)(SavegamesBase);
export { Savegames }
