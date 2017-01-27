#include "IconExtractorWindows.h"

#include <windows.h>
#include <Shlobj.h>
#include <gdiplus.h>
#include <exception>
#include <limits>
#include <vector>
#include <sstream>

#undef max

using namespace Gdiplus;

std::wstring string_cast(const char *source, size_t sourceLength = std::numeric_limits<size_t>::max()) {
  std::wstring result;

  if (sourceLength == std::numeric_limits<size_t>::max()) {
    sourceLength = strlen(source);
  }
  if (sourceLength > 0) {
    int outLength = MultiByteToWideChar(
        CP_UTF8, 0, source, static_cast<int>(sourceLength), &result[0], 0);
    if (outLength == 0) {
      throw std::runtime_error("string conversion failed");
    }
    result.resize(outLength);
    outLength =
        MultiByteToWideChar(CP_UTF8, 0, source, static_cast<int>(sourceLength),
                            &result[0], outLength);
    if (outLength == 0) {
      throw std::runtime_error("string conversion failed");
    }
    while (result[outLength - 1] == L'\0') {
      result.resize(--outLength);
    }
  }

  return result;
}

IconExtractorWindows::IconExtractorWindows() {
  GdiplusStartupInput input;
  GdiplusStartup(&m_GDIToken, &input, nullptr);

  initEncoders();
}

IconExtractorWindows::~IconExtractorWindows() { GdiplusShutdown(m_GDIToken); }

void IconExtractorWindows::initEncoders() {
  UINT encoderCount = 0;
  UINT encodersSize = 0; // in bytes

  GetImageEncodersSize(&encoderCount, &encodersSize);
  if (encodersSize == 0) {
    throw std::runtime_error("failed to query image encoders");
  }

  ImageCodecInfo *codecInfo = (ImageCodecInfo *)(malloc(encodersSize));
  if (codecInfo == nullptr) {
    throw std::bad_alloc();
  }

  GetImageEncoders(encoderCount, encodersSize, codecInfo);

  for (UINT j = 0; j < encoderCount; ++j) {
    m_Encoders[codecInfo[j].MimeType] = codecInfo[j].Clsid;
  }
  free(codecInfo);
}

bool IconExtractorWindows::saveBitmap(const std::string &output,
                                      HBITMAP bitmap) {
  Bitmap *image = new Bitmap(bitmap, nullptr);

  auto iter = m_Encoders.find(L"image/png");
  if (iter == m_Encoders.end()) {
    throw std::runtime_error("output to png not supported");
  }

  Status res = image->Save(string_cast(output.c_str(), output.size()).c_str(), &iter->second, nullptr);

  delete image;
  return true;
}

bool IconExtractorWindows::extractIconToPngFile(const std::string &executable,
                                                const std::string &output,
                                                int width,
                                                const std::string &format) {
  std::wstring filePath =
      string_cast(executable.c_str(), executable.length()).c_str();

  HICON icon;
  HRESULT res = SHDefExtractIconW(filePath.c_str(), 0, 0, &icon, nullptr, width);

  if (FAILED(res)) {
    return false;
  }

  Bitmap *image = Bitmap::FromHICON(icon);

  auto iter = m_Encoders.find((std::wstring(L"image/") + string_cast(format.c_str())).c_str());
  if (iter == m_Encoders.end()) {
    std::ostringstream msg;
    msg << "output to " << format << "not supported";
    throw std::runtime_error(msg.str().c_str());
  }

  CLSID sid = iter->second;

  Status saveRes = image->Save(string_cast(output.c_str(), output.size()).c_str(), &sid, nullptr);

  delete image;
  return saveRes == 0;
}
