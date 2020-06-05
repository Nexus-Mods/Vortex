import { IExtensionApi, IRunParameters } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import onceCB from '../../util/onceCB';

import { needToDeploy } from './selectors';

import Promise from 'bluebird';
import getText from './texts';
import { UserCanceled } from '../../util/CustomErrors';

type DeployResult = 'auto' | 'yes' | 'skip' | 'cancel';

function queryDeploy(api: IExtensionApi): Promise<DeployResult> {
  const state: IState = api.store.getState();
  if (!needToDeploy(state)) {
    return Promise.resolve<DeployResult>('auto');
  } else {
    const t = api.translate;
    return api.showDialog('question', t('Pending deployment'), {
      bbcode: t('Mod deployment {{more}} is pending.[br][/br]'
        + 'This means that changes made to mods such as updating, '
        + 'enabling/disabling, as well as newly set mod rules need to be deployed to take effect.[br][/br]'
        + 'You can skip this step, ignoring (but not reverting) newly made changes to mods and mod rules, '
        + 'or deploy now to commit the changes.', {
          replace: { more: `[More id='more-deploy' name='${t('Deployment')}']${getText('deployment', t)}[/More]` }
        })
    }, [{ label: 'Cancel' }, { label: 'Skip' }, { label: 'Deploy' }])
      .then((result) => {
        switch (result.action) {
          case 'Skip': return Promise.resolve<DeployResult>('skip');
          case 'Deploy': return Promise.resolve<DeployResult>('yes');
          default: return Promise.resolve<DeployResult>('cancel');
        }
      });
  }
}

function checkDeploy(api: IExtensionApi): Promise<void> {
  return queryDeploy(api)
    .then(shouldDeploy => {
      if (shouldDeploy === 'yes') {
        return new Promise<void>((resolve, reject) => {
          api.events.emit('deploy-mods', onceCB((err) => {
            if (err !== null) {
              reject(err);
            } else {
              resolve();
            }
          }));
        });
      } else if (shouldDeploy === 'auto') {
        return new Promise<void>((resolve, reject) => {
          api.events.emit('await-activation', (err: Error) => {
            if (err !== null) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      } else if (shouldDeploy === 'cancel') {
        return Promise.reject(new UserCanceled());
      } else { // skip
        return Promise.resolve();
      }
    });
}

function preStartDeployHook(api: IExtensionApi, input: IRunParameters): Promise<IRunParameters> {
   return (input.options.suggestDeploy === true)
    ? checkDeploy(api).then(() => input)
    : Promise.resolve(input);
}

export default preStartDeployHook;
