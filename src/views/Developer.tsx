import * as CoreActions from '../actions/actions';
import * as SettingsInterfaceActions from '../extensions/settings_interface/actions';

import * as LogMonTool from '../util/DevTools';
import { log } from '../util/log';

import * as React from 'react';
import { Component } from 'react';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import { createDevTools } from 'redux-devtools';

import Dispatcher from 'redux-devtools-dispatch';

const actionCreators = {};

/**
 * super hacky way of creating action creators for the dev tool from
 * all exported actions in a action-module.
 * This assumes the action is created with redux-act
 */
function addCreators(mod: Object) {
  // get name of all exports from the module, we assume the module
  // exports only actions!
  for (let exp in mod) {
    if (!mod.hasOwnProperty(exp)) {
      continue;
    }

    // create a dummy action we can inspect. redux-act turns parameters into a
    // dictionary. pass numbered values so we can restore parameter order later 
    let dummy = mod[exp](1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    if (typeof(dummy.payload) === 'object') {
      // this is a fairly awkward mechanism to restore the function parameter names from
      // payload object created by the payload reducer in createAction 

      // take the payload object and turn the keys (which should correspond to action
      // parameters) into an array, sorted by value (1 to 10, see above)
      let parameterNames = Object.keys(dummy.payload).sort(
        (lhs, rhs) => dummy.payload[lhs] - dummy.payload[rhs]
      );

      // synthesize and store a function that creates an action message the same way redux-act would
      let funcBody = `return { type: "${dummy.type}", payload: {${parameterNames}} };`;
      actionCreators[exp] = new Function(...parameterNames, funcBody);
    } else {
      // if there is only one parameter there is no way to restore its name
      actionCreators[exp] = (arg) => mod[exp](arg);
    }
  }
}

class Developer extends Component<{}, {}> {

  private DispatcherTool;

  constructor() {
    super();

    addCreators(CoreActions);
    addCreators(SettingsInterfaceActions);

    this.DispatcherTool = createDevTools(<Dispatcher actionCreators={actionCreators} />);
  }

  public render() {
    let DispatcherTool = this.DispatcherTool;
    return (
      <Layout type='column' style={{ minHeight: '600px' }}>
        <Fixed>
          <DispatcherTool />
        </Fixed>
        <Flex>
          <LogMonTool />
        </Flex>
      </Layout>
    );
  }
}

export default Developer;
