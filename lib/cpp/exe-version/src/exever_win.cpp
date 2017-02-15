#include <nan.h>
#include <sstream>
#include <windows.h>

#undef max

using namespace Nan;
using namespace v8;

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

NAN_METHOD(getVersion) {
  String::Utf8Value executablePath(info[0]->ToString());

  DWORD handle;
  DWORD info_len = ::GetFileVersionInfoSizeW(string_cast(*executablePath).c_str(), &handle);
  if (info_len == 0) {
    info.GetReturnValue().SetUndefined();
    return;
  }

  std::vector<char> buff(info_len);
  if (!::GetFileVersionInfoW(string_cast(*executablePath).c_str(), handle, info_len, buff.data())) {
    info.GetReturnValue().SetUndefined();
    return;
  }

  VS_FIXEDFILEINFO *pFileInfo;
  UINT buf_len;
  if (!::VerQueryValueW(buff.data(), L"\\", reinterpret_cast<LPVOID *>(&pFileInfo), &buf_len)) {
    info.GetReturnValue().SetUndefined();
    return;
  }

  std::ostringstream result;
  result << HIWORD(pFileInfo->dwFileVersionMS) << "." << LOWORD(pFileInfo->dwFileVersionMS)
    << "." << HIWORD(pFileInfo->dwFileVersionLS) << "." << LOWORD(pFileInfo->dwFileVersionLS);

  info.GetReturnValue().Set(Nan::New<String>(result.str().c_str()).ToLocalChecked());
}

NAN_MODULE_INIT(Init) {
  Nan::Set(target, New<v8::String>("getVersion").ToLocalChecked(),
    GetFunction(New<v8::FunctionTemplate>(getVersion)).ToLocalChecked());
}

NODE_MODULE(exeversion, Init)
