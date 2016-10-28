#include <nan.h>
#ifdef WIN32
#include "IconExtractorWindows.h"
#define IconExtractorImpl IconExtractorWindows
#elif __APPLE__
#include "IconExtractorMacOSX.h"
#define IconExtractorImpl IconExtractorMacOSX
#else
#include "IconExtractorLinux.h"
#define IconExtractorImpl IconExtractorLinux
#endif

using namespace Nan;
using namespace v8;

IconExtractorImpl &instance() {
  static IconExtractorImpl instance;
  return instance;
}

class IconExtractorWorker : public AsyncWorker {
public:
  IconExtractorWorker(Callback *callback,
    const std::string &executable,
    const std::string &output,
    int width,
    const std::string &format)
    : AsyncWorker(callback)
    , m_Executable(executable)
    , m_Output(output)
    , m_Width(width)
    , m_Format(format) {}

  ~IconExtractorWorker() {}

  void Execute() {
    try {
      instance().extractIconToPngFile(m_Executable, m_Output, m_Width, m_Format);
    }
    catch (const std::exception &e) {
      SetErrorMessage(e.what());
    }
  }

  // We have the results, and we're back in the event loop.
  void HandleOKCallback() {
    Nan::HandleScope scope;

    Local<Value> argv[] = {
      Null(),
      Boolean::New(Isolate::GetCurrent(), true)
    };

    callback->Call(2, argv);
  }

private:
  std::string m_Executable;
  std::string m_Output;
  int m_Width;
  std::string m_Format;

  std::string m_Error;

};

NAN_METHOD(extractIconToFile) {
  String::Utf8Value executable(info[0]->ToString());
  String::Utf8Value output(info[1]->ToString());
  int width = To<int>(info[2]).FromJust();
  String::Utf8Value format(info[3]->ToString());
  Callback *callback = new Callback(info[4].As<Function>());

  AsyncQueueWorker(new IconExtractorWorker(callback, *executable, *output, width, *format));
}

NAN_MODULE_INIT(Init) {
  Nan::Set(target, New<v8::String>("extractIconToFile").ToLocalChecked(),
    GetFunction(New<v8::FunctionTemplate>(extractIconToFile)).ToLocalChecked());
}

NODE_MODULE(iconextract, Init)
