import { types } from 'vortex-api';

function main(context: types.IExtensionContext) {
  context.registerAction('global-icons', 100, 'menu', {}, 'Sample', () => {
    context.api.showDialog('info', 'Success!', {
      text: 'Hello World',
    }, [
      { label: 'Close' },
    ]);
  });
  return true;
}

export default main;
