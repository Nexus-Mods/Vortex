#include <nan.h>
#include <iostream>
#include <map>
#include <atomic>

#include "walk.h"
#include "string_cast.h"

using namespace Nan;
using namespace v8;

v8::Local<v8::String> operator "" _n(const char *input, size_t) {
  return Nan::New(input).ToLocalChecked();
}

v8::Local<v8::Object> convert(const Entry &input) {
  v8::Local<v8::Object> result = Nan::New<v8::Object>();
  result->Set("filePath"_n,
    Nan::New(toMB(input.filePath.c_str(), CodePage::UTF8, input.filePath.size())).ToLocalChecked());
  result->Set("isDirectory"_n, Nan::New((input.attributes & FILE_ATTRIBUTE_DIRECTORY) != 0));
  result->Set("size"_n, Nan::New(static_cast<double>(input.size)));
  result->Set("mtime"_n, Nan::New(input.mtime));
  result->Set("isTerminator"_n, Nan::New((input.attributes & FILE_ATTRIBUTE_TERMINATOR) != 0));

  if (input.linkCount.isSet()) {
    result->Set("linkCount"_n, Nan::New(*input.linkCount));
  }
  if (input.id.isSet()) {
    result->Set("id"_n, Nan::New(static_cast<double>(*input.id)));
  }

  return result;
}

v8::Local<v8::Array> convert(const Entry *input, size_t count) {
  v8::Local<v8::Array> result = Nan::New<v8::Array>();
  for (size_t i = 0; i < count; ++i) {
    result->Set(i, convert(input[i]));
  }
  return result;
}

class WalkWorker : public AsyncProgressQueueWorker<Entry> {
 public:
  WalkWorker(Callback *callback, Callback *progress, const std::wstring &basePath, const WalkOptions &options)
    : AsyncProgressQueueWorker<Entry>(callback)
    , mProgress(progress)
    , mBasePath(basePath)
    , mOptions(options)
  {}

  ~WalkWorker() {
    delete mProgress;
  }

  void Execute(const AsyncProgressQueueWorker<Entry>::ExecutionProgress &progress) {
    walk(mBasePath, [&progress, this](const std::vector<Entry> &entries) {
      progress.Send(&entries[0], entries.size());
    }, mOptions);
  }

  void HandleProgressCallback(const Entry *data, size_t size) {
    Nan::HandleScope scope;

    v8::Local<v8::Value> argv[] = {
        convert(data, size).As<v8::Value>()
    };
    mProgress->Call(1, argv);
  }

  void HandleOKCallback () {
    Nan::HandleScope scope;

    Local<Value> argv[] = {
        Null()
    };


    callback->Call(1, argv);
  }

 private:
   Callback *mProgress;
   std::wstring mBasePath;
   WalkOptions mOptions;
};




template <typename T>
T cast(const v8::Local<v8::Value> &input);

template <>
bool cast(const v8::Local<v8::Value> &input) {
  return input->BooleanValue();
}

template <>
int cast(const v8::Local<v8::Value> &input) {
  return input->Int32Value();
}

template <typename T>
T get(const v8::Local<v8::Object> &obj, const char *key, const T &def) {
  v8::Local<v8::String> keyLoc = Nan::New(key).ToLocalChecked();
  return obj->Has(keyLoc) ? cast<T>(obj->Get(keyLoc)) : def;
}

NAN_METHOD(walku8) {
  if (info.Length() < 3) {
    Nan::ThrowTypeError("Expected 3 or 4 arguments");
    return;
  }

  String::Utf8Value basePath(info[0]->ToString());
  Callback *progress = new Callback(To<v8::Function>(info[1]).ToLocalChecked());
  Callback *callback = new Callback(To<v8::Function>(info[2]).ToLocalChecked());

  WalkOptions options;
  if (info.Length() > 3) {
    v8::Local<v8::Object> optionsIn = To<v8::Object>(info[3]).ToLocalChecked();
    options.details = get(optionsIn, "details", false);
    options.terminators = get(optionsIn, "terminators", false);
    options.threshold = get(optionsIn, "threshold", 1024);
    options.recurse = get(optionsIn, "recurse", true);
    options.skipHidden = get(optionsIn, "skipHidden", true);
  }

  std::wstring walkPath = toWC(*basePath, CodePage::UTF8, strlen(*basePath));
  AsyncQueueWorker(new WalkWorker(callback, progress, walkPath, options));
}

NAN_MODULE_INIT(Init) {
  Nan::Set(target, New<v8::String>("default").ToLocalChecked(),
    GetFunction(New<v8::FunctionTemplate>(walku8)).ToLocalChecked());
}

NODE_MODULE(turbowalk, Init)
