import { ComponentEx } from '../../util/ComponentEx';
import StarterInfo from '../../util/StarterInfo';
import { Button } from '../../views/TooltipControls';

import ToolIcon from './ToolIcon';

import * as I18next from 'i18next';
import * as React from 'react';
import { Dropdown, MenuItem } from 'react-bootstrap';

export type RemoveTool = (gameId: string, toolId: string) => void;

export interface IProps {
  t: I18next.TranslationFunction;
  starter: StarterInfo;
  primary: boolean;
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

  constructor(props: IProps) {
    super(props);

    this.initState({ imageUrl: undefined });
  }

  public componentDidMount() {
    this.mImageId = new Date().getTime();
  }

  public render() {
    const { primary, starter } = this.props;
    const valid = (starter.exePath !== undefined) && (starter.exePath !== '');

    const icon = <ToolIcon imageUrl={starter.iconPath} imageId={this.mImageId} valid={valid} />;

    const buttonClass = primary ? 'tool-button-primary' : 'tool-button';

    return (
      <Dropdown
        key={starter.id}
        id={`tool-dropdown-${starter.id}`}
        className='tool-dropdown'
      >
        <Button
          id={`tool-button-${starter.id}`}
          className={buttonClass}
          tooltip={starter.name}
          onClick={valid ? this.run : this.edit}
        >
          {icon}
        </Button>
        <Dropdown.Toggle />
        {this.renderMenu()}
      </Dropdown>
    );
  }

  private renderMenu(): JSX.Element {
    const { t, primary, starter } = this.props;
    const items = [];

    if (!primary && (starter.exePath !== '')) {
      items.push(
        <MenuItem key='set-item' onSelect={this.makePrimary}>
          {t('Set as primary tool')}
        </MenuItem>);
    }

    if (!primary && !starter.isGame) {
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
