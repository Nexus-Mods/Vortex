const mockModule = jest.genMockFromModule('../src/util/ComponentEx');

// Override connect, translate and extend since Jest mocks don't work as HOCs
module.exports = {
  ...mockModule,
  connect: require('react-redux').connect,
  translate: require('__mocks__/react-i18next').withTranslation,
  extend: () => (component) => component,
};
