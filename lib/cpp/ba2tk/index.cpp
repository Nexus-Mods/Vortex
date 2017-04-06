#include "nbind/noconflict.h"
#include "ba2tk/src/ba2archive.h"
#include <vector>
#include <nan.h>


const char *convertErrorCode(BA2::EErrorCode code) {
  switch (code) {
    case BA2::ERROR_ACCESSFAILED: return "access failed";
    case BA2::ERROR_CANCELED: return "canceled";
    case BA2::ERROR_FILENOTFOUND: return "file not found";
    case BA2::ERROR_INVALIDDATA: return "invalid data";
    case BA2::ERROR_INVALIDHASHES: return "invalid hashes";
    case BA2::ERROR_SOURCEFILEMISSING: return "source file missing";
    case BA2::ERROR_ZLIBINITFAILED: return "zlib init failed";
    case BA2::ERROR_NONE: return nullptr;
    default: return "unknown";
  }
}

class ExtractWorker : public Nan::AsyncWorker {
public:
  ExtractWorker(std::shared_ptr<BA2::Archive> archive,
             const char *outputrDirectory,
             Nan::Callback *appCallback)
    : Nan::AsyncWorker(appCallback)
    , m_Archive(archive)
    , m_OutputDirectory(outputrDirectory)
  {}

  void Execute() {
    BA2::EErrorCode code;
    code = m_Archive->extract(m_OutputDirectory.c_str());
    if (code != BA2::ERROR_NONE) {
      SetErrorMessage(convertErrorCode(code));
    }
  }

  void HandleOKCallback() {
    Nan::HandleScope scope;

    v8::Local<v8::Value> argv[] = {
      Nan::Null()
    };

    callback->Call(1, argv);
  }
private:
  std::shared_ptr<BA2::Archive> m_Archive;
  std::string m_OutputDirectory;
};


class BA2Archive {
public:
  BA2Archive(const char *fileName)
    : m_Wrapped(new BA2::Archive())
  {
    read(fileName);
  }

  BA2Archive(const BA2Archive &ref)
    : m_Wrapped(ref.m_Wrapped)
  {
  }

  ~BA2Archive() {
  }
  }

  void read(const char *fileName) {
    BA2::EErrorCode err = m_Wrapped->read(fileName);
    if (err != BA2::ERROR_NONE) {
      throw std::runtime_error(convertErrorCode(err));
    }
  }

private:
  std::shared_ptr<BA2::Archive> m_Wrapped;
};

class LoadWorker : public Nan::AsyncWorker {
public:
  LoadWorker(const char *fileName, Nan::Callback *appCallback)
    : Nan::AsyncWorker(appCallback)
    , m_OutputDirectory(fileName)
  {
  }

  void Execute() {
    try {
      m_Result = new BA2Archive(m_OutputDirectory.c_str());
    }
    catch (const std::exception &e) {
      SetErrorMessage(e.what());
    }
  }

  void HandleOKCallback() {
    Nan::HandleScope scope;

    v8::Local<v8::Value> argv[] = {
      Nan::Null()
      , nbind::convertToWire(*m_Result)
    };

    callback->Call(2, argv);
    delete m_Result;
  }
private:
  BA2Archive *m_Result;
  std::string m_OutputDirectory;
};


void loadBA2(const char *fileName, nbind::cbFunction &callback) {
  Nan::AsyncQueueWorker(
    new LoadWorker(
      fileName,
      new Nan::Callback(callback.getJsFunction())
  ));
}


NBIND_CLASS(BA2Archive) {
  NBIND_CONSTRUCT<const char*, bool>();
  NBIND_GETTER(getType);
  NBIND_METHOD(extract);
}

NBIND_FUNCTION(loadBA2);
