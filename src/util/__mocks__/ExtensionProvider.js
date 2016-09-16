const ext = jest.genMockFromModule('../ExtensionProvider');

function extension(registerFunc) {
  return (module) => {
    return module;
  } 
}

ext.extension = extension;

module.exports = ext;