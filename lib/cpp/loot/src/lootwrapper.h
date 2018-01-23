#pragma once

#include <loot/api.h>
#include <functional>
#include <map>
#include <memory>
#include <set>
#include "nbind/nbind.h"

// bound unwrapped
using loot::Tag;
using loot::MessageContent;
using loot::PluginCleaningData;
using loot::Priority;
using loot::File;
using loot::Location;

struct MasterlistInfo : public loot::MasterlistInfo {
  MasterlistInfo() {}
  MasterlistInfo(loot::MasterlistInfo info);

  void toJS(nbind::cbOutput output) const;

  std::string getRevisionId() const;
  std::string getRevisionDate() const;
  bool getIsModified() const;
};

class Message : public loot::Message {
public:
  Message() : loot::Message() {}
  Message(const loot::Message &reference)
    : loot::Message(reference)
  {
  }

  unsigned int type() {
    return static_cast<unsigned int>(GetType());
  }

  std::string value(const std::string &language) const {
    return GetContent(language).GetText();
  }
};

struct PluginMetadata : public loot::PluginMetadata {
  PluginMetadata(const loot::PluginMetadata &input);

  void toJS(nbind::cbOutput output) const;

  std::vector<Tag> tags() const {
    std::set<loot::Tag> tags = GetTags();
    std::vector<Tag> result(tags.size());
    std::copy(tags.begin(), tags.end(), result.begin());
    return result;
  }

  std::vector<Message> messages() const {
    std::vector<loot::Message> messages = GetMessages();
    std::vector<Message> result(messages.size());
    std::copy(messages.begin(), messages.end(), result.begin());
    return result;
  }

  std::vector<loot::File> requirements() const {
    std::set<loot::File> files = GetRequirements();
    std::vector<loot::File> result(files.size());
    std::copy(files.begin(), files.end(), result.begin());
    return result;
  }
 
  std::vector<loot::File> incompatibilities() const {
    std::set<loot::File> files = GetIncompatibilities();
    std::vector<loot::File> result(files.size());
    std::copy(files.begin(), files.end(), result.begin());
    return result;
  } 

  std::vector<loot::File> loadAfterFiles() const {
    std::set<loot::File> files = GetLoadAfterFiles();
    std::vector<loot::File> result(files.size());
    std::copy(files.begin(), files.end(), result.begin());
    return result;
  }

  std::vector<loot::PluginCleaningData> cleanInfo() const {
    std::set<loot::PluginCleaningData> data = GetCleanInfo();
    std::vector<loot::PluginCleaningData> result(data.size());
    std::copy(data.begin(), data.end(), result.begin());
    return result;
  }

  std::vector<loot::PluginCleaningData> dirtyInfo() const {
    std::set<loot::PluginCleaningData> data = GetDirtyInfo();
    std::vector<loot::PluginCleaningData> result(data.size());
    std::copy(data.begin(), data.end(), result.begin());
    return result;
  }

  std::vector<loot::Location> locations() const {
    std::set<loot::Location> data = GetLocations();
    std::vector<loot::Location> result(data.size());
    std::copy(data.begin(), data.end(), result.begin());
    return result;
  }
};

class Loot {

public:

  Loot(std::string gameId, std::string gamePath, std::string gameLocalPath);

  void updateMasterlist(std::string masterlistPath, std::string remoteUrl, std::string remoteBranch,
    nbind::cbFunction &callback);

  MasterlistInfo getMasterlistRevision(std::string masterlistPath, bool getShortId) const;

  void loadLists(std::string masterlistPath, std::string userlistPath, nbind::cbFunction &callback);

  PluginMetadata getPluginMetadata(std::string plugin);

  void sortPlugins(std::vector<std::string> input, nbind::cbFunction &callback);

private:

  void assertNotBusy(const char *call) const;
  loot::GameType convertGameId(const std::string &gameId) const;

private:

  std::string m_Busy = "";
  std::shared_ptr<loot::GameInterface> m_Game;

};

NBIND_CLASS(MasterlistInfo) {
  getter(getRevisionId);
  getter(getRevisionDate);
  getter(getIsModified);
}

NBIND_CLASS(MessageContent) {
  getter(GetText);
  getter(GetLanguage);
}

NBIND_CLASS(Tag) {
  getter(IsAddition);
  getter(GetName);
}

NBIND_CLASS(Priority) {
  getter(GetValue);
  getter(IsExplicit);
}

NBIND_CLASS(Message) {
  getter(type);
  method(value);
}

NBIND_CLASS(File) {
  getter(GetName);
  getter(GetDisplayName);
}

NBIND_CLASS(PluginMetadata) {
  getter(messages);
  getter(GetName);
  getter(tags);
  getter(cleanInfo);
  getter(dirtyInfo);
  getter(GetGlobalPriority);
  getter(incompatibilities);
  getter(loadAfterFiles);
  getter(GetLocalPriority);
  getter(locations);
  getter(requirements);
  getter(messages);
  getter(IsEnabled);
}
 
NBIND_CLASS(PluginCleaningData) {
  getter(GetCRC);
  getter(GetITMCount);
  getter(GetDeletedReferenceCount);
  getter(GetDeletedNavmeshCount);
  getter(GetCleaningUtility);
  getter(GetInfo);
}

NBIND_CLASS(Location) {
  getter(GetURL);
  getter(GetName);
}

NBIND_CLASS(Loot) {
  construct<std::string, std::string, std::string>();
  method(updateMasterlist);
  method(getMasterlistRevision);
  method(loadLists);
  method(getPluginMetadata);
  method(sortPlugins);
}

using loot::IsCompatible;

NBIND_GLOBAL() {
  function(IsCompatible);
}
