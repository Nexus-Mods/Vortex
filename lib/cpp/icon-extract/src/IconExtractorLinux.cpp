#include "icon.h"

void extractIconToFile(const std::string &executable, const std::string &output) {
  // TODO on linux executables have no associated icon, but they usually have a
  //   meta file /usr/share/applications/<appname>.desktop that contains an icon
  //   name which can then be found at
  //   /usr/share/icons/[hi,lo]color/<widthxheight>/appname.png
  //   TBH this lookup would probably be easier to do in JS as linux doesn't use
  //   a custom icon format.
}
