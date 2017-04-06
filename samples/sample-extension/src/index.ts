import { log, types } from 'nmm-api';

function main(context: types.IExtensionContext) {
  context.registerIcon('application-icons', 100, 'hand-peace-o', 'Sample', () => {
    log('info', 'hello world');
  });
  return true;
}

export default main;
