#include "IconExtractorImpl.h"
#include <string>
#include <map>

class IconExtractorLinux: public IconExtractorImpl {
public:
  IconExtractorLinux() {};
  ~IconExtractorLinux() {};

  bool extractIconToPngFile(const std::string &executable,
                            const std::string &output,
                            int width,
                            const std::string &format);
};

