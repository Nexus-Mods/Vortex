#include "IconExtractorImpl.h"
#include <string>
#include <map>
#include <windows.h>

class IconExtractorWindows: public IconExtractorImpl {
public:
  IconExtractorWindows();
  ~IconExtractorWindows();

  bool extractIconToPngFile(const std::string &executable,
                            const std::string &output,
                            int width,
                            const std::string &format);

private:
  void initEncoders();
  bool saveBitmap(const std::string &output, HBITMAP bitmap);

private:
  ULONG_PTR m_GDIToken;
  std::map<std::wstring, CLSID> m_Encoders;
};
