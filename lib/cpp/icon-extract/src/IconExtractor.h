/*#include <nan.h>
#include <string>

class IconExtractorImpl;

class IconExtractor {
  public:
    IconExtractor();
    ~IconExtractor();

    bool extractToFile(std::string executable,
                       std::string output,
                       int width,
                       std::string format);
  private:
    IconExtractorImpl *m_Impl;
};

NAN_METHOD(extractIconToFile) {
    int under = To<int>(info[0]).FromJust();
    Callback *callback = new Callback(info[1].As<Function>());

    AsyncQueueWorker(new PrimeWorker(callback, under));
}


NAN_MODULE_INIT(Init) {
    Nan::Set(target, New<Nan::String>("extractIconToFile").ToLocalChecked(),
        GetFunction(New<Nan::FunctionTemplate>(extractIconToFile)).ToLocalChecked());
}

NODE_MODULE(icon-extract, Init)*/