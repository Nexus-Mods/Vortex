import Icon from '../../controls/Icon';
import IconBar from '../../controls/IconBar';
import { Button } from '../../controls/TooltipControls';
import { IActionDefinition } from '../../types/IActionDefinition';
import { PureComponentEx } from '../../util/ComponentEx';
import StarterInfo from '../../util/StarterInfo';
import { truthy } from '../../util/util';

import { setPrimaryTool } from './actions';
import ToolIcon from './ToolIcon';

import * as I18next from 'i18next';
import * as React from 'react';
import { Dropdown, Image, MenuItem } from 'react-bootstrap';

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

class ToolButton extends PureComponentEx<IProps, IToolButtonState> {
  private mImageId: number;
  private mStaticElements: IActionDefinition[];

  constructor(props: IProps) {
    super(props);

    this.initState({ imageUrl: undefined });

    this.mStaticElements = [
      {
        title: props.t('Run'),
        icon: 'launch-simple',
        action: () => this.props.onRun(this.props.starter),
        condition: () => truthy(this.props.starter.exePath),
        options: {
          noCollapse: true,
        },
      },
      {
        title: props.t('Make primary'),
        icon: 'bookmark',
        action: this.setPrimaryTool,
        condition: () => truthy(this.props.starter.exePath)
          ? true : props.t('Not configured'),
      },
      {
        title: props.t('Edit'),
        icon: 'edit',
        action: this.edit,
      },
      {
        title: props.t('Remove'),
        icon: 'remove',
        action: this.remove,
        condition: () => !this.props.starter.isGame,
      },
    ];
  }

  public componentDidMount() {
    this.mImageId = new Date().getTime();
  }

  public render() {
    const { primary, starter } = this.props;
    const valid = (starter.exePath !== undefined) && (starter.exePath !== '');

    const classes = [
      'tool-button',
    ];
    if (primary) {
      classes.push('tool-button-primary');
    }

    return (
      <div className={classes.join(' ')}>
        <div className='tool-icon-container'>
          <ToolIcon imageUrl={starter.iconPath} imageId={this.mImageId} valid={valid} />
        </div>
        <span>{starter.name}</span>
        {primary ? <Icon className='tool-bookmark' name='bookmark'/> : null}
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

  private remove = () => {
    const { onRemove, starter } = this.props;
    onRemove(starter);
  }

  private setPrimaryTool = () => {
    const { onMakePrimary, starter } = this.props;
    onMakePrimary(starter);
  }

  private edit = () => {
    const { onEdit, starter }  = this.props;
    onEdit(starter);
  }

  private run = () => {
    const { onRun, starter } = this.props;
    onRun(starter);
  }
}

export default ToolButton;
