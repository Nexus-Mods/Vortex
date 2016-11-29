#include "esptk/src/espfile.h"
#include "nbind/nbind.h"
#include <vector>

class ESPFile : public ESP::File {
public:
  ESPFile(const std::string &fileName): ESP::File(fileName) {} 
  std::vector<std::string> masterList() const {
    std::vector<std::string> result;
    std::set<std::string> input = masters();
    std::copy(input.begin(), input.end(), std::back_inserter(result));

    return result;
  }
};

NBIND_CLASS(ESPFile) {
  construct<std::string>();
  getter(isMaster);
  getter(isDummy);
  getter(author);
  getter(description);
  getter(masterList);
}
