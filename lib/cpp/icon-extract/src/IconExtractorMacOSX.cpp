#include "icon.h"

void extractIconToFile(const std::string &executable, const std::string &output) {
  // TODO on macos the application is stored in the application bundle in Contents/Resources
  //   as a separate file.
  //   As a convention it should have the same name as the bundle. It can be in any supported
  //   image format but preferrably in icns format which we need to handle (libicns)
}
