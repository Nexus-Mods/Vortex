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

const char *toIsoLanguage(loot::LanguageCode code) {
  switch (code) {
  case loot::LanguageCode::brazilian_portuguese: return "pt_BR";
  case loot::LanguageCode::chinese: return "ch";
  case loot::LanguageCode::danish: return "da";
  case loot::LanguageCode::english: return "en";
  case loot::LanguageCode::finnish: return "fi";
  case loot::LanguageCode::french: return "fr";
  case loot::LanguageCode::german: return "de";
  case loot::LanguageCode::korean: return "ko";
  case loot::LanguageCode::polish: return "pl";
  case loot::LanguageCode::russian: return "ru";
  case loot::LanguageCode::spanish: return "es";
  case loot::LanguageCode::swedish: return "sv";
  }
  Nan::ThrowError("unsupported language code");
  return "";
}

loot::LanguageCode fromIsoLanguage(const char *code) {
  const std::map<std::string, loot::LanguageCode> langMap {
    { "ch",loot::LanguageCode::chinese },
    { "da",loot::LanguageCode::danish },
    { "en",loot::LanguageCode::english },
    { "fi",loot::LanguageCode::finnish },
    { "fr",loot::LanguageCode::french },
    { "de",loot::LanguageCode::german },
    { "ko",loot::LanguageCode::korean },
    { "pl",loot::LanguageCode::polish },
    { "ru",loot::LanguageCode::russian },
    { "es",loot::LanguageCode::spanish },
    { "sv",loot::LanguageCode::swedish }
  };

  const std::map<std::string, loot::LanguageCode> langCountryMap{
    { "pt_BR", loot::LanguageCode::brazilian_portuguese }
  };

  // first, see if we have a lang+country code
  auto iter = langCountryMap.find(code);
  if (iter != langCountryMap.end()) {
    return iter->second;
  }
  // if not, try again looking for just the language
  iter = langMap.find(std::string(code, 2));
  return iter != langMap.end() ? iter->second : loot::LanguageCode::english;
}

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

LootDatabase::LootDatabase(std::string gameId, std::string gamePath, std::string gameLocalPath)
{
  try {
    m_Database = loot::CreateDatabase(convertGameId(gameId), gamePath, gameLocalPath);
  }
  catch (const std::exception &e) {
    Nan::ThrowError(e.what());
  }
}

void LootDatabase::assertNotBusy() const {
  if (m_Busy) {
    // TODO Fails with an error I don't understand
    Nan::ThrowError("Can't be used while asynchronous api is working");
  }
}

void LootDatabase::updateMasterlist(std::string masterlistPath, std::string remoteUrl, std::string remoteBranch,
  nbind::cbFunction &callback) {
  assertNotBusy();
  m_Busy = true;
  Nan::AsyncQueueWorker(
    new Worker<bool>(
      [=]() { return m_Database->UpdateMasterlist(masterlistPath, remoteUrl, remoteBranch); },
      new Nan::Callback(callback.getJsFunction()),
      [this]() -> void { this->m_Busy = false; }
  ));
}

void LootDatabase::loadLists(std::string masterlistPath, std::string userlistPath, nbind::cbFunction &callback)
{
  assertNotBusy();
  m_Busy = true;
  Nan::AsyncQueueWorker(
    new Worker<void>(
      [=]() { m_Database->LoadLists(masterlistPath, userlistPath); },
      new Nan::Callback(callback.getJsFunction()),
      [this]() -> void { this->m_Busy = false; }));
}

void LootDatabase::evalLists(nbind::cbFunction &callback)
{
  assertNotBusy();
  m_Busy = true;
  Nan::AsyncQueueWorker(
    new Worker<void>(
      [this]() { m_Database->EvalLists(); },
      new Nan::Callback(callback.getJsFunction()),
    [this]() -> void {
    this->m_Busy = false;
  }));
}

std::vector<SimpleMessage> LootDatabase::getPluginMessages(std::string plugin, std::string languageCode)
{
  assertNotBusy();
  std::vector<SimpleMessage> res;
  auto input = m_Database->GetPluginMessages(plugin, fromIsoLanguage(languageCode.c_str()));
  std::transform(input.begin(), input.end(), std::back_inserter(res),
    [](const loot::SimpleMessage &in) -> SimpleMessage { return SimpleMessage(in); }
  );
  return res;
}

std::string LootDatabase::getPluginCleanliness(std::string plugin)
{
  assertNotBusy();
  switch (m_Database->GetPluginCleanliness(plugin)) {
  case loot::PluginCleanliness::clean: return "clean";
  case loot::PluginCleanliness::dirty: return "dirty";
  case loot::PluginCleanliness::do_not_clean: return "do_not_clean";
  default: return "unknown";
  }
}

PluginTags LootDatabase::getPluginTags(std::string plugin)
{
  assertNotBusy();
  return m_Database->GetPluginTags(plugin);
}

MasterlistInfo LootDatabase::getMasterlistRevision(std::string masterlistPath, bool getShortId) const {
  assertNotBusy();
  return m_Database->GetMasterlistRevision(masterlistPath, getShortId);
}

void LootDatabase::sortPlugins(std::vector<std::string> input, nbind::cbFunction &callback)
{
  assertNotBusy();
  Nan::AsyncQueueWorker(
    new Worker<std::vector<std::string>>(
      [this, input]() { return m_Database->SortPlugins(input); },
      new Nan::Callback(callback.getJsFunction()),
    [this]() -> void {
    this->m_Busy = false;
  }));
}

loot::GameType LootDatabase::convertGameId(const std::string &gameId) const {
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

inline SimpleMessage::SimpleMessage(const loot::SimpleMessage & input)
  : loot::SimpleMessage()
{
  this->type = input.type;
  this->language = input.language;
  this->text = input.text;
}

inline void SimpleMessage::toJS(nbind::cbOutput output) const {
  output(type, language, text);
}

inline std::string SimpleMessage::getType() const {
  switch (this->type) {
  case loot::MessageType::say: return "say";
  case loot::MessageType::warn: return "warn";
  case loot::MessageType::error: return "error";
  default: return "unknown";
  }
}

inline std::string SimpleMessage::getLanguage() const {
  return toIsoLanguage(this->language);
}

inline std::string SimpleMessage::getText() const {
  return this->text;
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
