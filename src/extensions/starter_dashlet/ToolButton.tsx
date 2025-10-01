import IconBar from '../../controls/IconBar';
import { TFunction } from '../../util/i18n';
import StarterInfo from '../../util/StarterInfo';
import ToolIcon from '../../controls/ToolIcon';

import { IStarterInfo } from '../../util/StarterInfo';

import React from 'react';
import { useDrop } from 'react-dnd';

export type RemoveTool = (gameId: string, toolId: string) => void;

export interface IToolButtonProps {
  t: TFunction;
  counter: number;
  item: IStarterInfo;
  valid: boolean;
  primary: boolean;
  running: boolean;
  onMoveItem: (hoverId: string, id: string) => any;
  onRun: (starter: IStarterInfo) => void;
  onMakePrimary: (starter: IStarterInfo) => void;
  onRemove: (starter: IStarterInfo) => void;
  onEdit: (starter: IStarterInfo) => void;
}

function ToolButton(props: IToolButtonProps) {
  const { t, counter, item, primary, running, onRun,
    onMakePrimary, onRemove, onEdit, valid } = props;

  let imageSrc;
  const starter = item as StarterInfo;
  if (!starter) {
    return null;
  }
  try {
    imageSrc = StarterInfo.getIconPath(starter);
  } catch (err) {
    return null;
  }
  const remove = React.useCallback(() => {
    onRemove(starter);
  }, [onRemove, starter]);

  const setPrimaryTool = React.useCallback(() => {
    onMakePrimary(starter);
  }, [onMakePrimary, starter]);

  const edit = React.useCallback(() => {
    onEdit(starter);
  }, [onEdit, starter]);

  const run = React.useCallback(() => {
    onRun(starter);
  }, [onRun, starter]);

  const staticElements = [
    {
      title: 'Run',
      icon: 'launch-simple',
      action: run,
      condition: () => valid ? true : t('Not configured') as string,
    },
    {
      title: primary ? 'Unset as primary' : 'Set as primary',
      icon: 'plugin-master',
      action: setPrimaryTool,
      condition: () => (primary || valid) ? true : t('Not configured') as string,
    },
    {
      title: 'Edit',
      icon: 'edit',
      action: edit,
    },
    {
      title: 'Remove',
      icon: 'remove',
      action: remove,
      condition: () => !starter.isGame,
    },
  ];

  const classes = ['tool-button'];
  if (primary) {
    classes.push('tool-button-primary');
  }
  const [spec, dropRef] = useDrop({
    accept: 'TOOL',
    hover: (hoveredOverItem: any) => {
      if (hoveredOverItem.id !== props.item.id) {
        props.onMoveItem(hoveredOverItem.id, props.item.id);
      }
    }});
  return (
    <>
      <div ref={dropRef} className={classes.join(' ')}>
        <div className='tool-icon-container'>
          <ToolIcon
            t={t}
            item={props.item}
            imageUrl={imageSrc}
            imageId={counter}
            isPrimary={primary}
            valid={valid}
            onRun={run}
          />
        </div>
        <div className='tool-icon-text'>
          <div className='tool-icon-name'>{starter.name}</div>
          {running ? <div className='tool-icon-running'>{t('Running...')}</div> : null}
        </div>
      </div>
      <IconBar
        id={`tool-starter-${starter.id}`}
        className='buttons'
        group='tool-starter'
        instanceId={starter.id}
        staticElements={staticElements}
        collapse={true}
        t={t}
      />
    </>
  );
}

export default ToolButton;
