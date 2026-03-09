import { configure } from "enzyme";
import Adapter from "enzyme-adapter-react-16";

/** @type import("../shared/types/preload").PreloadWindow */
const preloadWindow = window;

preloadWindow.api = {
  log: () => {},
};

configure({ adapter: new Adapter() });
