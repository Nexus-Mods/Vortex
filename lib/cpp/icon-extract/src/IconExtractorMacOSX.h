#include "IconExtractorImpl.h"
#include <string>
#include <map>

class IconExtractorMacOSX: public IconExtractorImpl {
public:
  IconExtractorMacOSX();
  ~IconExtractorMacOSX();

  bool extractIconToPngFile(const std::string &executable,
                            const std::string &output,
                            int width,
                            const std::string &format);
};
