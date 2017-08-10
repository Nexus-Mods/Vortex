import { log, types } from 'vortex-api';

function main(context: types.IExtensionContext) {
  context.registerAction('application-icons', 100, 'hand-peace-o', {}, 'Sample', () => {
    log('info', 'hello world');
  });
  return true;
}

export default main;
