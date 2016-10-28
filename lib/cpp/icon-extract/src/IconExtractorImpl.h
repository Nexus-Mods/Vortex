#include <string>

class IconExtractorImpl {
public:
  virtual ~IconExtractorImpl() {};

  virtual bool extractIconToPngFile(const std::string &executable,
                                    const std::string &output,
                                    int width,
                                    const std::string &format) = 0;
};
