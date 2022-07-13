import { BoxWithHandle } from './BoxWithHandle';
import ToolButton from './ToolButton';
import { IStarterInfo } from '../../util/StarterInfo';
import { makeExeId } from '../../reducers/session';

import { getSafe } from '../../util/storeHelper';

import * as React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { activeGameId } from '../../util/selectors';

import { IRunningTool } from '../../types/IState';

import { useDebouncedCallback } from './useDebouncedCallback';

interface IConnectedProps {
  primaryTool: string;
  toolsRunning: { [exePath: string]: IRunningTool };
}

interface IToolProps {
  starter: IStarterInfo;
  idx: number;
  counter: number;
  validToolIds: string[];
  tools: IStarterInfo[];
  startTool: (starter: IStarterInfo) => void;
  applyOrder: (ordered: string[]) => void;
  editTool: (starter: IStarterInfo) => void;
  removeTool: (starter: IStarterInfo) => void;
  setPrimary: (starter: IStarterInfo) => void;
}

function Tool(props: IToolProps) {
  const { t } = useTranslation();
  const { toolsRunning, primaryTool } = useSelector(mapStateToProps);
  const { counter, starter, idx, validToolIds,
    applyOrder, startTool, editTool, removeTool, setPrimary, tools } = props;

  const running = (starter.exePath !== undefined)
               && (toolsRunning[makeExeId(starter.exePath)] !== undefined);
  
  const moveItem = useDebouncedCallback((srcId: string, destId: string) => {
    const sourceIndex = tools.findIndex(item => item.id === srcId);
    const destinationIndex = tools.findIndex(item => item.id === destId);
    if (sourceIndex === -1 || destinationIndex === -1) {
      return;
    }
    const offset = destinationIndex - sourceIndex;
    const newOrder = moveElement(tools, sourceIndex, offset);
    applyOrder(newOrder.map(starter => starter.id));
  }, 100, [applyOrder, tools]);

  return (
    <BoxWithHandle
      index={idx}
      key={starter.id}
      item={starter}
      onMoveItem={moveItem}
      {...props}
    >
      <ToolButton
        t={t}
        valid={validToolIds.includes(starter.id)}
        primary={starter.id === primaryTool}
        counter={counter}
        item={starter}
        running={running}
        onRun={startTool}
        onEdit={editTool}
        onMoveItem={moveItem}
        onRemove={removeTool}
        onMakePrimary={setPrimary}
      />
    </BoxWithHandle>);
}

function mapStateToProps(state: any): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    toolsRunning: state.session.base.toolsRunning,
  };
}

function move(array, oldIndex, newIndex) {
  if (newIndex >= array.length) {
    newIndex = array.length - 1;
  }
  const newArray = [...array];
  newArray.splice(newIndex, 0, newArray.splice(oldIndex, 1)[0]);
  return newArray;
}

function moveElement(array, index, offset) {
  const newIndex = index + offset;
  return move(array, index, newIndex);
}

export default Tool;