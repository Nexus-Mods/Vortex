import { ExtensionProvider, extend } from '../out/util/ExtensionProvider';
import * as React from 'react';
import { mount, shallow } from 'enzyme';

function register(val) {
  return 42;
}

let applyCalled;
let MockComponent = () => <div>Dummy</div>;
let WrapperComponent = extend(register)(MockComponent);

let dummyExtension = {
  apply: (funcname, callback) => {
    applyCalled = funcname;
    callback();
  }
};

describe('extend', () => {
  let instance, wrapper;

  beforeEach(() => {
    applyCalled = undefined;
    wrapper = shallow(<WrapperComponent />, {
      context: {
        extensions: dummyExtension
      }
    });
    instance = wrapper.instance();
  });

  it('renders the component at root', () => {
    expect(wrapper.first().is(MockComponent)).toBe(true);
  });

  it('calls apply with the register function', () => {
    expect(applyCalled).toBe('register');
  });

  it('registers the extensions', () => {
    expect(wrapper.first().props().objects).toEqual([ 42 ]);
  });
});

describe('ExtensionProvider', () => {
  it('has a child context', () => {
    let provider = mount(<ExtensionProvider extensions={dummyExtension}><WrapperComponent /></ExtensionProvider>);
    expect(provider.find(MockComponent).props().objects).toEqual([42]);
  });
});
