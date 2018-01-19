#include "lootwrapper.h"
#undef function

#include <map>
#include <future>
#include <nan.h>

struct UnsupportedGame : public std::runtime_error {
  UnsupportedGame() : std::runtime_error("game not supported") {}
};

struct BusyException : public std::runtime_error {
  BusyException() : std::runtime_error("Loot connection is busy") {}
};

template <typename T> v8::Local<v8::Value> ToV8(const T &value) {
  return Nan::New(value);
}

template <> v8::Local<v8::Value> ToV8(const std::vector<std::string> &value) {
  v8::Local<v8::Array> res = Nan::New<v8::Array>();
  uint32_t counter = 0;
  for (const std::string &val : value) {
    res->Set(counter++, Nan::New(val.c_str()).ToLocalChecked());
  }
  return res;
}

template <typename ResT>
class Worker : public Nan::AsyncWorker {
public:
  Worker(std::function<ResT()> func, Nan::Callback *appCallback, std::function<void()> internalCallback)
    : Nan::AsyncWorker(appCallback)
    , m_Func(func)
    , m_IntCallback(internalCallback)
  {
  }

  void Execute() {
    try {
      m_Result = m_Func();
    }
    catch (const std::exception &e) {
      SetErrorMessage(e.what());
    }
  }

  void HandleOKCallback() {
    Nan::HandleScope scope;

    v8::Local<v8::Value> argv[] = {
      Nan::Null()
      , ToV8(m_Result)
    };

    m_IntCallback();
    callback->Call(2, argv);
  }

  void HandleErrorCallback() {
    m_IntCallback();
    Nan::AsyncWorker::HandleErrorCallback();
  }

private:
  ResT m_Result;
  std::function<ResT()> m_Func;
  std::function<void()> m_IntCallback;
};

template <>
class Worker<void> : public Nan::AsyncWorker {
public:
  Worker(std::function<void()> func, Nan::Callback *appCallback, std::function<void()> internalCallback)
    : Nan::AsyncWorker(appCallback)
    , m_Func(func)
    , m_IntCallback(internalCallback)
  {
  }

  void Execute() {
    try {
      m_Func();
    }
    catch (const std::exception &e) {
      SetErrorMessage(e.what());
    }
  }

  void HandleOKCallback() {
    Nan::HandleScope scope;

    v8::Local<v8::Value> argv[] = {
      Nan::Null()
    };

    m_IntCallback();
    callback->Call(1, argv);
  }

  void HandleErrorCallback() {
    m_IntCallback();
    Nan::AsyncWorker::HandleErrorCallback();
  }

private:
  std::function<void()> m_Func;
  std::function<void()> m_IntCallback;
};

Loot::Loot(std::string gameId, std::string gamePath, std::string gameLocalPath)
{
  try {
    loot::InitialiseLocale("en_US");
    m_Game = loot::CreateGameHandle(convertGameId(gameId), gamePath, gameLocalPath);
  }
  catch (const std::exception &e) {
    Nan::ThrowError(e.what());
  }
}

void Loot::assertNotBusy() const {
  if (m_Busy) {
    // TODO Fails with an error I don't understand
    Nan::ThrowError("Can't be used while asynchronous api is working");
  }
}

void Loot::updateMasterlist(std::string masterlistPath, std::string remoteUrl, std::string remoteBranch,
  nbind::cbFunction &callback) {
  assertNotBusy();
  m_Busy = true;
  Nan::AsyncQueueWorker(
    new Worker<bool>(
      [=]() { return m_Game->GetDatabase()->UpdateMasterlist(masterlistPath, remoteUrl, remoteBranch); },
      new Nan::Callback(callback.getJsFunction()),
      [this]() -> void { this->m_Busy = false; }
  ));
}

void Loot::loadLists(std::string masterlistPath, std::string userlistPath, nbind::cbFunction &callback)
{
  assertNotBusy();
  m_Busy = true;
  Nan::AsyncQueueWorker(
    new Worker<void>(
      [=]() { m_Game->GetDatabase()->LoadLists(masterlistPath, userlistPath); },
      new Nan::Callback(callback.getJsFunction()),
      [this]() -> void { this->m_Busy = false; }));
}

PluginMetadata Loot::getPluginMetadata(std::string plugin)
{
  assertNotBusy();
  return m_Game->GetDatabase()->GetPluginMetadata(plugin, true, true);
}

MasterlistInfo Loot::getMasterlistRevision(std::string masterlistPath, bool getShortId) const {
  assertNotBusy();
  return m_Game->GetDatabase()->GetMasterlistRevision(masterlistPath, getShortId);
}

void Loot::sortPlugins(std::vector<std::string> input, nbind::cbFunction &callback)
{
  assertNotBusy();
  Nan::AsyncQueueWorker(
    new Worker<std::vector<std::string>>(
      [this, input]() { return m_Game->SortPlugins(input); },
      new Nan::Callback(callback.getJsFunction()),
    [this]() -> void {
    this->m_Busy = false;
  }));
}

loot::GameType Loot::convertGameId(const std::string &gameId) const {
  std::map<std::string, loot::GameType> gameMap{
    { "oblivion", loot::GameType::tes4 },
    { "skyrim", loot::GameType::tes5 },
    { "skyrimse", loot::GameType::tes5se },
    { "fallout3", loot::GameType::fo3 },
    { "falloutnv", loot::GameType::fonv },
    { "fallout4", loot::GameType::fo4 }
  };

  auto iter = gameMap.find(gameId);
  if (iter == gameMap.end()) {
    throw UnsupportedGame();
  }
  return iter->second;
}

PluginMetadata::PluginMetadata(const loot::PluginMetadata &reference)
  : loot::PluginMetadata(reference)
{
}

void PluginMetadata::toJS(nbind::cbOutput output) const {
  output(this->GetName());
}

inline MasterlistInfo::MasterlistInfo(loot::MasterlistInfo info)
{
  this->revision_id = info.revision_id;
  this->revision_date = info.revision_date;
  this->is_modified = info.is_modified;
}

inline void MasterlistInfo::toJS(nbind::cbOutput output) const {
  output(revision_id, revision_date, is_modified);
}

inline std::string MasterlistInfo::getRevisionId() const {
  return revision_id;
}

inline std::string MasterlistInfo::getRevisionDate() const {
  return revision_date;
}

inline bool MasterlistInfo::getIsModified() const {
  return is_modified;
}
