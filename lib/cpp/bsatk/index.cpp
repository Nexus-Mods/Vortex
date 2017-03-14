#include "nbind/noconflict.h"
#include "bsatk/src/bsaarchive.h"
#include <vector>
#include <nan.h>

class BSAFile {
public:
  BSAFile(std::shared_ptr<BSA::File> file)
    : m_File(file)
  {}

  BSA::File::Ptr getWrappee() const { return m_File; }

  std::string getName() const { return m_File->getName(); }
  std::string getFilePath() const { return m_File->getFilePath(); }
  unsigned long getFileSize() const { return m_File->getFileSize(); }

private:
  BSA::File::Ptr m_File;
};

class BSAFolder {
public:
  BSAFolder(std::shared_ptr<BSA::Folder> folder)
    : m_Folder(folder)
  {
  }

  std::string getName() const { return m_Folder->getName(); }
  std::string getFullPath() const { return m_Folder->getFullPath(); }
  unsigned int getNumSubFolders() const { return m_Folder->getNumSubFolders(); }
  BSAFolder getSubFolder(unsigned int index) const { return BSAFolder(m_Folder->getSubFolder(index)); }
  unsigned int getNumFiles() const { return m_Folder->getNumFiles(); }
  unsigned int countFiles() const { return m_Folder->countFiles(); }
  const BSAFile getFile(unsigned int index) const { return BSAFile(m_Folder->getFile(index)); }
  void addFile(const BSAFile &file) { m_Folder->addFile(file.getWrappee()); }
  BSAFolder addFolder(const std::string &folderName) { return BSAFolder(m_Folder->addFolder(folderName)); }

private:
  std::shared_ptr<BSA::Folder> m_Folder;
};

class BSArchive {
public:
  BSArchive(const char *fileName, bool testHashes)
    : m_Wrapped(new BSA::Archive())
  {
    read(fileName, testHashes);
  }

  BSArchive(const BSArchive &ref)
    : m_Wrapped(ref.m_Wrapped)
  {
  }

  ~BSArchive() {
    m_Wrapped->close();
  }

  BSAFolder getRoot() {
    return BSAFolder(m_Wrapped->getRoot());
  }

  const char *getType() const {
    switch (m_Wrapped->getType()) {
      case BSA::Archive::TYPE_OBLIVION: return "oblivion";
      case BSA::Archive::TYPE_SKYRIM:   return "skyrim";
      // fallout 3 and fallout nv use the same type as
      // skyrim
      default: return nullptr;
    }
  }

  void read(const char *fileName, bool testHashes) {
    BSA::EErrorCode err = m_Wrapped->read(fileName, testHashes);
    if (err != BSA::ERROR_NONE) {
      throw std::runtime_error(convertErrorCode(err));
    }
  }

private:

  const char *convertErrorCode(BSA::EErrorCode code) {
    switch (code) {
      case BSA::ERROR_ACCESSFAILED: return "access failed";
      case BSA::ERROR_CANCELED: return "canceled";
      case BSA::ERROR_FILENOTFOUND: return "file not found";
      case BSA::ERROR_INVALIDDATA: return "invalid data";
      case BSA::ERROR_INVALIDHASHES: return "invalid hashes";
      case BSA::ERROR_SOURCEFILEMISSING: return "source file missing";
      case BSA::ERROR_ZLIBINITFAILED: return "zlib init failed";
      case BSA::ERROR_NONE: return nullptr;
      default: return "unknown";
    }
  }

private:
  std::shared_ptr<BSA::Archive> m_Wrapped;
};

class LoadWorker : public Nan::AsyncWorker {
public:
  LoadWorker(const char *fileName, bool testHashes, Nan::Callback *appCallback)
    : Nan::AsyncWorker(appCallback)
    , m_FileName(fileName)
    , m_TestHashes(testHashes)
  {
  }

  void Execute() {
    try {
      m_Result = new BSArchive(m_FileName.c_str(), m_TestHashes);
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

  void HandleErrorCallback() {
    Nan::AsyncWorker::HandleErrorCallback();
  }

private:
  BSArchive *m_Result;
  std::string m_FileName;
  bool m_TestHashes;
};


void loadBSA(const char *fileName, bool testHashes, nbind::cbFunction &callback) {
  Nan::AsyncQueueWorker(
    new LoadWorker(
      fileName, testHashes,
      new Nan::Callback(callback.getJsFunction())
  ));
}

NBIND_CLASS(BSAFile) {
  NBIND_GETTER(getName);
  NBIND_GETTER(getFilePath);
  NBIND_GETTER(getFileSize);
}

NBIND_CLASS(BSAFolder) {
  NBIND_GETTER(getName);
  NBIND_GETTER(getFullPath);
  NBIND_GETTER(getNumSubFolders);
  NBIND_GETTER(getNumFiles);
  NBIND_METHOD(getSubFolder);
  NBIND_METHOD(countFiles);
  NBIND_METHOD(getFile);
  NBIND_METHOD(addFile);
  NBIND_METHOD(addFolder);

}

NBIND_CLASS(BSArchive) {
  NBIND_CONSTRUCT<const char*, bool>();
  NBIND_GETTER(getType);
  NBIND_GETTER(getRoot);
}

NBIND_FUNCTION(loadBSA);
