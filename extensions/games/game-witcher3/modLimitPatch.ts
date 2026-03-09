/* eslint-disable */
import _ from 'lodash';
import path from 'path';
import { actions, fs, selectors, types, util } from 'vortex-api';

import { setSuppressModLimitPatch } from './actions';

import { GAME_ID, I18N_NAMESPACE } from './common';

/**
 * Theoretically the mod limit patcher is no longer needed (CDPR raised the file handle limit)
 *  but we will still keep this functionality in case it is needed in the future.
 */

const RANGE_START = 0xB94000;
const RANGE_END = 0xB98000;

const UNPATCHED_SEQ = [0xBA, 0xC0, 0x00, 0x00, 0x00, 0x48, 0x8D, 0x4B];
const PATCHED_SEQ = [0xBA, 0xF4, 0x01, 0x00, 0x00, 0x48, 0x8D, 0x4B];

const OFFSET = 65536;

export class ModLimitPatcher {
  private mApi: types.IExtensionApi;
  private mIsPatched: boolean;

  constructor(api: types.IExtensionApi) {
    this.mApi = api;
    this.mIsPatched = false;
  }

  public async ensureModLimitPatch() {
    const state = this.mApi.getState();
    const game: types.IGameStored = selectors.gameById(state, GAME_ID);
    const discovery = state.settings.gameMode.discovered[GAME_ID];
    if (!discovery?.path) {
      throw new util.ProcessCanceled('Game is not discovered');
    }
    await this.queryPatch();
    const stagingPath = selectors.installPathForGame(state, GAME_ID);
    const modName = 'Mod Limit Patcher';
    let mod: types.IMod = util.getSafe(state, ['persistent', 'mods', GAME_ID, modName], undefined);
    if (mod === undefined) {
      try {
        await this.createModLimitPatchMod(modName);
        mod = util.getSafe(this.mApi.getState(),
          ['persistent', 'mods', GAME_ID, modName], undefined);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    try {
      const src = path.join(discovery.path, game.executable);
      const dest = path.join(stagingPath, mod.installationPath, game.executable);
      await fs.removeAsync(dest)
        .catch(err => ['ENOENT'].includes(err.code) ? Promise.resolve() : Promise.reject(err));
      await fs.copyAsync(src, dest);
      const tempFile = dest + '.tmp';
      await this.streamExecutable(RANGE_START, RANGE_END, dest, tempFile);
      await fs.removeAsync(dest);
      await fs.renameAsync(tempFile, dest);
      this.mApi.sendNotification({
        message: 'Patch generated successfully',
        type: 'success',
        displayMS: 5000,
      });
    } catch (err) {
      const allowReport = !(err instanceof util.UserCanceled)
      this.mApi.showErrorNotification('Failed to generate mod limit patch', err, { allowReport });
      this.mApi.events.emit('remove-mod', GAME_ID, modName);
      return Promise.resolve(undefined);
    }

    return Promise.resolve(modName);
  }

  public getLimitText(t: any) {
    return t('Witcher 3 is restricted to 192 file handles which is quickly reached when '
      + 'adding mods (about ~25 mods) - Vortex has detected that the current mods environment may be '
      + 'breaching this limit; this issue will usually exhibit itself by the game failing to start up.{{bl}}'
      + 'Vortex can attempt to patch your game executable to increase the available file handles to 500 '
      + 'which should cater for most if not all modding environments.{{bl}}Please note - the patch is applied as '
      + 'a mod which will be generated and automatically enabled; to disable the patch, simply remove or disable '
      + 'the "Witcher 3 Mod Limit Patcher" mod and the original game executable will be restored.',
      { ns: I18N_NAMESPACE, replace: { bl: '[br][/br][br][/br]', br: '[br][/br]' } });
  }

  private async queryPatch(): Promise<void> {
    const t = this.mApi.translate;
    const message = this.getLimitText(t);
    const res: types.IDialogResult = await (this.mApi.showDialog('question', 'Mod Limit Patch', {
      bbcode: message,
      checkboxes: [
        { id: 'suppress-limit-patcher-test', text: 'Do not ask again', value: false }
      ],
    }, [
      { label: 'Cancel' },
      { label: 'Generate Patch' },
    ]) as any);
    if (res.input['suppress-limit-patcher-test'] === true) {
      this.mApi.store.dispatch(setSuppressModLimitPatch(true));
    }
    if (res.action === 'Cancel') {
      throw new util.UserCanceled();
    }

    return Promise.resolve();
  }

  private createModLimitPatchMod(modName: string): Promise<void> {
    const mod = {
      id: modName,
      state: 'installed',
      attributes: {
        name: 'Mod Limit Patcher',
        description: 'Witcher 3 is restricted to 192 file handles which is quickly reached when '
                   + 'adding mods (about ~25 mods) - this mod increases the limit to 500',
        logicalFileName: 'Witcher 3 Mod Limit Patcher',
        modId: 42, // Meaning of life
        version: '1.0.0',
        installTime: new Date(),
      },
      installationPath: modName,
      type: 'w3modlimitpatcher',
    };

    return new Promise((resolve, reject) => {
      this.mApi.events.emit('create-mod', GAME_ID, mod, async (error) => {
        if (error !== null) {
          return reject(error);
        }
        const profileId = selectors.lastActiveProfileForGame(this.mApi.getState(), GAME_ID);
        this.mApi.store.dispatch(actions.setModEnabled(profileId, modName, true));
        return resolve();
      });
    });
  }

  private hasSequence(sequence: Buffer, chunk: Buffer) {
    const firstSeqByte = sequence[0];
    let foundSeq = false;
    let iter = 0;
    while (iter < chunk.length) {
      if (!foundSeq && chunk[iter] === firstSeqByte) {
        const subArray = _.cloneDeep(Array.from(chunk.slice(iter, iter + sequence.length)));
        foundSeq = _.isEqual(sequence, Buffer.from(subArray));
      }
      iter++;
    }

    return foundSeq;
  }

  private patchChunk(chunk: Buffer): Buffer {
    const idx = chunk.indexOf(Buffer.from(UNPATCHED_SEQ));
    const patchedBuffer = Buffer.from(PATCHED_SEQ);
    const data = Buffer.alloc(chunk.length);
    data.fill(chunk.slice(0, idx), 0, idx);
    data.fill(patchedBuffer, idx, idx + patchedBuffer.length);
    data.fill(chunk.slice(idx + patchedBuffer.length), idx + patchedBuffer.length);
    return data;
  }

  private async streamExecutable(start: number,
                                 end: number,
                                 filePath: string,
                                 tempPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempPath);
      const stream = fs.createReadStream(filePath);
      const unpatched = Buffer.from(UNPATCHED_SEQ);
      const patched = Buffer.from(PATCHED_SEQ);
      const onError = (err: Error) => {
        this.mIsPatched = false;
        writer.end();
        if (!stream.destroyed) {
          stream.close();
        }
        return reject(err);
      };
      stream.on('end', () => {
        this.mIsPatched = false;
        writer.end();
        return resolve();
      });
      stream.on('error', onError);
      stream.on('data', ((chunk: Buffer) => {
        if (this.mIsPatched || (stream.bytesRead + OFFSET) < start || stream.bytesRead > end + OFFSET) {
          writer.write(chunk);
        } else {
          if (this.hasSequence(unpatched, chunk)) {
            const patchedBuffer = this.patchChunk(chunk);
            writer.write(patchedBuffer);
            this.mIsPatched = true;
          } else if (this.hasSequence(patched, chunk)) {
            // exec is already patched.
            this.mIsPatched = true;
            writer.write(chunk);
          } else {
            writer.write(chunk);
          }
        }
      }));
    });
  }
}
