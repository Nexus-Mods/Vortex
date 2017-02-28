#pragma once

#include <loot/api.h>
#include <functional>
#include <map>
#include <memory>
#include "nbind/nbind.h"


const char *toIsoLanguage(loot::LanguageCode code);
loot::LanguageCode fromIsoLanguage(const char *code);

struct MasterlistInfo : public loot::MasterlistInfo {
  MasterlistInfo() {}
  MasterlistInfo(loot::MasterlistInfo info);

  void toJS(nbind::cbOutput output) const;

  std::string getRevisionId() const;
  std::string getRevisionDate() const;
  bool getIsModified() const;
};

/**
 * wrapper for loot::SimpleMessage translating to standard datatypes
 */
struct SimpleMessage : public loot::SimpleMessage {
  SimpleMessage(const loot::SimpleMessage &input);
 
  void toJS(nbind::cbOutput output) const;

  std::string getType() const;
  std::string getLanguage() const;
  std::string getText() const;
};

struct PluginTags {
  PluginTags() {}

  PluginTags(const loot::PluginTags &input)
    : added(input.added.begin(), input.added.end())
    , removed(input.removed.begin(), input.removed.end())
    , userlist_modified(input.userlist_modified)
  { }

  void toJS(nbind::cbOutput output) const {
    output(added, removed, userlist_modified);
  }

  std::vector<std::string> getAdded() const { return added; }
  std::vector<std::string> getRemoved() const { return removed; }
  bool getUserlistModified() const { return userlist_modified; }

private:
  std::vector<std::string> added;
  std::vector<std::string> removed;
  bool userlist_modified;
};

class LootDatabase {

public:

  LootDatabase(std::string gameId, std::string gamePath, std::string gameLocalPath);

  void updateMasterlist(std::string masterlistPath, std::string remoteUrl, std::string remoteBranch,
    nbind::cbFunction &callback);

  MasterlistInfo getMasterlistRevision(std::string masterlistPath, bool getShortId) const;

  void loadLists(std::string masterlistPath, std::string userlistPath, nbind::cbFunction &callback);
  void evalLists(nbind::cbFunction &callback);

  /**
   * get messages for a plugin.
   * @param plugin name of the plugin
   * @param languageCode iso code for the language in which to retrieve the message. This supports either
   *                     a iso-639-1 code like "de" for german or a iso-639-1 language code combined with
   *                     a iso-3166 country code, i.e. "de_DE". Falls back to english if language is missing
   */
  std::vector<SimpleMessage> getPluginMessages(std::string plugin, std::string languageCode);
  std::string getPluginCleanliness(std::string plugin);
  PluginTags getPluginTags(std::string plugin);

  void sortPlugins(std::vector<std::string> input, nbind::cbFunction &callback);

private:

  void assertNotBusy() const;
  loot::GameType convertGameId(const std::string &gameId) const;

private:

  bool m_Busy{false};
  std::shared_ptr<loot::DatabaseInterface> m_Database;

};


NBIND_CLASS(MasterlistInfo) {
  getter(getRevisionId);
  getter(getRevisionDate);
  getter(getIsModified);
}

NBIND_CLASS(SimpleMessage) {
  getter(getType);
  getter(getLanguage);
  getter(getText);
}

NBIND_CLASS(PluginTags) {
  getter(getAdded);
  getter(getRemoved);
  getter(getUserlistModified);
}

NBIND_CLASS(LootDatabase) {
  construct<std::string, std::string, std::string>();
  method(updateMasterlist);
  method(getMasterlistRevision);
  method(loadLists);
  method(evalLists);
  method(getPluginMessages);
  method(getPluginCleanliness);
  method(getPluginTags);
  method(sortPlugins);
}

using loot::IsCompatible;

NBIND_GLOBAL() {
  function(IsCompatible);
}
