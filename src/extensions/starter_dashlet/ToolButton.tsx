import { IActionDefinition } from '../../types/IActionDefinition';
import { ComponentEx } from '../../util/ComponentEx';
import StarterInfo from '../../util/StarterInfo';
import Icon from '../../views/Icon';
import IconBar from '../../views/IconBar';
import { Button } from '../../views/TooltipControls';

import ToolIcon from './ToolIcon';

import * as I18next from 'i18next';
import * as React from 'react';
import { Dropdown, Image, MenuItem } from 'react-bootstrap';

export type RemoveTool = (gameId: string, toolId: string) => void;

export interface IProps {
  t: I18next.TranslationFunction;
  starter: StarterInfo;
  onRun: (starter: StarterInfo) => void;
  onMakePrimary: (starter: StarterInfo) => void;
  onRemove: (starter: StarterInfo) => void;
  onEdit: (starter: StarterInfo) => void;
}

export interface IToolButtonState {
  imageUrl: string;
}

class ToolButton extends ComponentEx<IProps, IToolButtonState> {
  private mImageId: number;
  private mStaticElements: IActionDefinition[];

  constructor(props: IProps) {
    super(props);

    this.initState({ imageUrl: undefined });

    this.mStaticElements = [
      {
        title: props.t('Run'),
        icon: 'button-play',
        action: () => props.onRun(props.starter),
      },
    ];
  }

  public componentDidMount() {
    this.mImageId = new Date().getTime();
  }

  public render() {
    const { starter } = this.props;
    const valid = (starter.exePath !== undefined) && (starter.exePath !== '');

    return (
      <div className='tool-button'>
        <ToolIcon imageUrl={starter.iconPath} imageId={this.mImageId} valid={valid} />
        <span>{starter.name}</span>
        <IconBar
          id={`tool-starter-${starter.id}`}
          className='buttons'
          group='tool-starter'
          instanceId={starter.id}
          staticElements={this.mStaticElements}
          collapse={true}
        />
      </div>
    );
  }

  private renderMenu(): JSX.Element {
    const { t, starter } = this.props;
    const items = [];

    if (starter.exePath !== '') {
      items.push(
        <MenuItem key='set-item' onSelect={this.makePrimary}>
          {t('Set as primary tool')}
        </MenuItem>);
    }

    if (!starter.isGame) {
      items.push(
        <MenuItem key='remove' onSelect={this.remove}>
          {t('Remove')}
        </MenuItem>);
    }

    if (items.length > 0) {
      items.push(<MenuItem key='divider' divider />);
    }

    items.push(
      <MenuItem key='properties' onClick={this.edit}>
        {t('Properties')}
      </MenuItem>);

    return (
      <Dropdown.Menu>
        {items}
      </Dropdown.Menu>);
  }

  private remove = () => {
    const { onRemove, starter } = this.props;
    onRemove(starter);
  }

  private edit = () => {
    const { onEdit, starter }  = this.props;
    onEdit(starter);
  }

  private run = () => {
    const { onRun, starter } = this.props;
    onRun(starter);
  }

  private makePrimary = () => {
    const { onMakePrimary, starter } = this.props;
    onMakePrimary(starter);
  }
}

export default ToolButton;
