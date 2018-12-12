import Icon from '../../controls/Icon';
import IconBar from '../../controls/IconBar';
import { IActionDefinition } from '../../types/IActionDefinition';
import { PureComponentEx } from '../../util/ComponentEx';
import StarterInfo from '../../util/StarterInfo';
import { truthy } from '../../util/util';

import ToolIcon from './ToolIcon';

import * as I18next from 'i18next';
import * as React from 'react';

export type RemoveTool = (gameId: string, toolId: string) => void;

export interface IProps {
  t: I18next.TranslationFunction;
  counter: number;
  starter: StarterInfo;
  primary: boolean;
  onRun: (starter: StarterInfo) => void;
  onMakePrimary: (starter: StarterInfo) => void;
  onRemove: (starter: StarterInfo) => void;
  onEdit: (starter: StarterInfo) => void;
}

class ToolButton extends PureComponentEx<IProps, {}> {
  private mStaticElements: IActionDefinition[];

  constructor(props: IProps) {
    super(props);

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

  public render() {
    const { t, counter, primary, starter } = this.props;
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
          <ToolIcon imageUrl={starter.iconPath} imageId={counter} valid={valid} />
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
          t={t}
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
