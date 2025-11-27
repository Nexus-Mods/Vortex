import { ICollection, ICollectionTool } from './types/ICollection';
import { IExtendedInterfaceProps } from './types/IExtendedInterfaceProps';
import ToolList from './views/Tools';

import * as path from 'path';
import * as React from 'react';
import { generate as shortid } from 'shortid';
import { actions, fs, log, selectors, types, util } from 'vortex-api';

function ToolsListWrap(prop: IExtendedInterfaceProps): JSX.Element {
  return React.createElement(ToolList, {
    ...prop,
  });
}

function convertTools(state: types.IState,
                      gameId: string,
                      includedTools: string[]): ICollectionTool[] {
  const { tools } = state.settings.gameMode.discovered[gameId];
  const discovery = selectors.discoveryByGame(state, gameId);

  return util.makeUniqueByKey(includedTools ?? [], item => item)
    .filter(toolId => tools[toolId]?.custom && !tools[toolId]?.hidden)
    .map(toolId => {
      const tool = tools[toolId];

      const exe = util.isChildPath(tool.path, discovery.path)
        ? path.relative(discovery.path, tool.path)
        : tool.path;

      return {
        name: tool.name,
        exe,
        args: tool.parameters,
        env: tool.environment,
        cwd: tool.workingDirectory,
        detach: tool.detach,
        shell: tool.shell,
        onStart: tool.onStart,
      };
    });
}

function generateTools(api: types.IExtensionApi, gameId: string, mod: types.IMod) {
  return {
    tools: convertTools(api.getState(), gameId, mod.attributes?.collection?.includedTools),
  };
}

interface ICollectionToolEx extends ICollectionTool {
  id?: string;
}

function normalizePath(input: string) {
  return path.normalize(input.toUpperCase());
}

function isSameTool(discovery: types.IDiscoveryResult,
                    lhs: types.IDiscoveredTool,
                    rhs: ICollectionTool) {
  if (lhs?.path === undefined) {
    return false;
  }
  return (normalizePath(lhs.path) === normalizePath(path.resolve(discovery.path, rhs.exe)))
      || (lhs.name === rhs.name);
}

function updatePaths(tool: ICollectionToolEx, gamePath: string) {
  return {
    ...tool,
    exe: path.isAbsolute(tool.exe)
    ? tool.exe
    : path.join(gamePath, tool.exe),
  };
}

async function cloneTools(api: types.IExtensionApi,
                          gameId: string,
                          tools: ICollectionTool[],
                          from: types.IMod,
                          to: types.IMod)
                          : Promise<void> {
  const discovery = selectors.discoveryByGame(api.getState(), gameId);

  const knownTools = api.getState().settings.gameMode.discovered[gameId].tools;

  const includedTools: string[] = (tools ?? []).map(tool => {
    const exePath = path.isAbsolute(tool.exe)
      ? tool.exe
      : path.join(discovery.path, tool.exe);

    return Object.keys(knownTools ?? {})
      .find(iter => (knownTools[iter].custom && !knownTools[iter].hidden)
                && (normalizePath(knownTools[iter].path) === normalizePath(exePath)
                 || knownTools[iter].name === tool.name));
  })
  .filter(iter => iter !== undefined);

  const attributes = util.setSafe(to.attributes.collection, ['includedTools'], includedTools);
  api.store.dispatch(actions.setModAttribute(gameId, to.id, 'collection',
                                             attributes));
}

async function setUpTools(api: types.IExtensionApi,
                          gameId: string,
                          tools: ICollectionTool[])
                          : Promise<void> {
  const knownTools = api.getState().settings.gameMode.discovered[gameId].tools;

  // create tools right away to prevent race conditions in case this is invoked multiple times,
  // icons are generated later, if necessary

  const discovery = selectors.discoveryByGame(api.getState(), gameId);

  const addTools: ICollectionToolEx[] = (tools ?? [])
    .map(tool => updatePaths(tool, discovery.path))
    .filter(tool => Object.values(knownTools ?? {})
      .find(iter => isSameTool(discovery, iter, tool)) === undefined);

  const addActions = addTools.map(tool => {
    tool.id = shortid();

    return actions.addDiscoveredTool(gameId, tool.id, {
      id: tool.id,
      path: tool.exe,
      name: tool.name,

      requiredFiles: [],
      executable: null,
      parameters: tool.args,
      environment: tool.env,
      workingDirectory: tool.cwd,
      shell: tool.shell,
      detach: tool.detach,
      onStart: tool.onStart,
      custom: true,
      hidden: true,
    }, true);
  });

  // this has to happen before we extract icons, otherwise we might create duplicates
  util.batchDispatch(api.store, addActions);

  const notFoundTools: string[] = [];

  await Promise.all(addTools.map(async tool => {
    try {
      await fs.statAsync(tool.exe);
    } catch (err) {
      notFoundTools.push(tool.name);
    }

    if (path.extname(tool.exe) === '.exe') {
      const iconPath = util.StarterInfo.toolIconRW(gameId, tool.id);
      await fs.ensureDirWritableAsync(path.dirname(iconPath), () => Promise.resolve());
      try {
        await util['extractExeIcon'](tool.exe, iconPath);
      } catch (err) {
        log('warn', 'failed to extract exe icon', { executable: tool.exe, error: err.message });
      }
    }
  }));

  if (notFoundTools.length > 0) {
    await api.showDialog('info', 'Tool not found', {
      text: 'The collection you just installed set up tools to be run from the dashboard, '
          + 'however not all were found locally. '
          + 'It\'s possible that these tools will be available after the next deployment '
          + 'completes, otherwise you may have to edit the configuration for the tool to '
          + 'adjust them to your own setup.',
      message: notFoundTools.join('\n'),
    }, [
      { label: 'Continue' },
    ]);
  }

  util.batchDispatch(api.store, addTools.map(tool =>
    actions.setToolVisible(gameId, tool.id, true)));
}

/*
  generate: (gameId: string, includedMods: string[]) => Promise<any>;
  parse: (gameId: string, collection: ICollection, mod: types.IMod) => Promise<void>;
*/

function init(context: types.IExtensionContext) {
  context.optional.registerCollectionFeature(
    'tools',
    (gameId: string, includedMods: string[], mod: types.IMod) =>
      generateTools(context.api, gameId, mod),
    (gameId: string, collection: ICollection, mod: types.IMod) =>
      setUpTools(context.api, gameId, collection['tools']),
    (gameId: string, collection: ICollection, from: types.IMod, to: types.IMod) =>
      cloneTools(context.api, gameId, collection['tools'], from, to),
    () => 'Tools',
    (state: types.IState, gameId: string) => true,
    ToolsListWrap,
  );
}

export default init;
