#include "lootwrapper.h"
#undef function

#include <map>
#include <future>
#include <nan.h>
#include <sstream>

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
    catch (...) {
      SetErrorMessage("unknown exception");
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
    catch (...) {
      SetErrorMessage("unknown exception");
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

Loot::Loot(std::string gameId, std::string gamePath, std::string gameLocalPath, std::string language)
  : m_Language(language)
{
  try {
    loot::InitialiseLocale(language);
    m_Game = loot::CreateGameHandle(convertGameId(gameId), gamePath, gameLocalPath);
  }
  catch (const std::exception &e) {
    Nan::ThrowError(e.what());
  }
  catch (...) {
    Nan::ThrowError("unknown exception");
  }
}

bool Loot::updateMasterlist(std::string masterlistPath, std::string remoteUrl, std::string remoteBranch) {
  try {
    return m_Game->GetDatabase()->UpdateMasterlist(masterlistPath, remoteUrl, remoteBranch);
  }
  catch (const std::exception &e) {
    NBIND_ERR(e.what());
    return false;
  }
}

void Loot::loadLists(std::string masterlistPath, std::string userlistPath)
{
  try {
    m_Game->GetDatabase()->LoadLists(masterlistPath, userlistPath);
  }
  catch (const std::exception &e) {
    NBIND_ERR(e.what());
  }
}

PluginMetadata Loot::getPluginMetadata(std::string plugin)
{
  try {
    return PluginMetadata(m_Game->GetDatabase()->GetPluginMetadata(plugin, true, true), m_Language);
  }
  catch (const std::exception &e) {
    NBIND_ERR(e.what());
    return PluginMetadata(loot::PluginMetadata(), m_Language);
  }
}

MasterlistInfo Loot::getMasterlistRevision(std::string masterlistPath, bool getShortId) const {
  try {
    return m_Game->GetDatabase()->GetMasterlistRevision(masterlistPath, getShortId);
  } catch (const std::exception &e) {
    NBIND_ERR(e.what());
    return loot::MasterlistInfo();
  }
}

std::vector<std::string> Loot::sortPlugins(std::vector<std::string> input)
{
  return m_Game->SortPlugins(input);
}

loot::GameType Loot::convertGameId(const std::string &gameId) const {
  std::map<std::string, loot::GameType> gameMap{
    { "oblivion", loot::GameType::tes4 },
    { "skyrim", loot::GameType::tes5 },
    { "skyrimse", loot::GameType::tes5se },
    { "fallout3", loot::GameType::fo3 },
    { "falloutnv", loot::GameType::fonv },
    { "fallout4", loot::GameType::fo4 },
    { "fallout4vr", loot::GameType::fo4vr }
  };

  auto iter = gameMap.find(gameId);
  if (iter == gameMap.end()) {
    throw UnsupportedGame();
  }
  return iter->second;
}

PluginMetadata::PluginMetadata(const loot::PluginMetadata &reference, const std::string &language)
  : m_Wrapped(reference), m_Language(language)
{
}

void PluginMetadata::toJS(nbind::cbOutput output) const {
  output(GetName(), GetMessages(), GetTags(), GetCleanInfo(), GetDirtyInfo(),
    std::vector<Priority>{ GetGlobalPriority() }, std::vector<Priority>{GetLocalPriority()},
    GetIncompatibilities(), GetLoadAfterFiles(), GetLocations(), GetRequirements(),
    IsEnabled());
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
