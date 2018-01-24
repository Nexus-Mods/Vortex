#pragma once

#include <loot/api.h>
#include <functional>
#include <map>
#include <memory>
#include <set>
#include "nbind/nbind.h"

template <typename T, typename LootT> std::vector<T> transform(const std::vector<LootT> &input) {
  std::vector<T> result;
  for (const auto &ele : input) {
    result.push_back(ele);
  }
  // std::copy(input.begin(), input.end(), result.begin());
  return result;
}

template <typename T, typename LootT> std::vector<T> transform(const std::set<LootT> &input) {
  // std::vector<T> result(input.size());
  // std::copy(input.begin(), input.end(), result.begin());
  std::vector<T> result;
  for (const auto &ele : input) {
    result.push_back(ele);
  }
  return result;
}

struct MasterlistInfo : public loot::MasterlistInfo {
  MasterlistInfo() {}
  MasterlistInfo(loot::MasterlistInfo info);

  void toJS(nbind::cbOutput output) const;

  std::string getRevisionId() const;
  std::string getRevisionDate() const;
  bool getIsModified() const;
};

class File : public loot::File {
public:
  File(const loot::File &reference) : loot::File(reference) {}

  void toJS(nbind::cbOutput output) const {
    output(GetName(), GetDisplayName());
  }
};

class Priority : public loot::Priority {
public:
  Priority(const loot::Priority &reference) : loot::Priority(reference) {}

  void toJS(nbind::cbOutput output) const {
    output(GetValue(), IsExplicit());
  }
};

class Tag : public loot::Tag {
public:
  Tag(const loot::Tag &reference) : loot::Tag(reference) {}

  void toJS(nbind::cbOutput output) const {
    output(this->GetName(), this->IsAddition(), this->IsConditional(), this->GetCondition());
  }
};

class MessageContent : public loot::MessageContent {
public:
  MessageContent(const loot::MessageContent &reference) : loot::MessageContent(reference) {}

  void toJS(nbind::cbOutput output) const {
    output(GetText());
  }
};

class Location : public loot::Location {
public:
  Location(const loot::Location &reference) : loot::Location(reference) {}

  void toJS(nbind::cbOutput output) const {
    output(this->GetName(), this->GetURL());
  }
};

class PluginCleaningData : public loot::PluginCleaningData {
public:
  PluginCleaningData(const loot::PluginCleaningData &reference) : loot::PluginCleaningData(reference) {}

  void toJS(nbind::cbOutput output) const {
    output(GetCleaningUtility(), GetCRC(), GetDeletedNavmeshCount(), GetDeletedReferenceCount(),
           GetITMCount(), transform<MessageContent>(GetInfo()));
  }
};

class Message : public loot::Message {
public:
  Message() : loot::Message() {}
  Message(const loot::Message &reference, const std::string &language)
    : loot::Message(reference), m_Language(language)
  {
  }

  void toJS(nbind::cbOutput output) const {
    output(type(), value(m_Language));
  }

  unsigned int type() const {
    return static_cast<unsigned int>(GetType());
  }

  std::string value(const std::string &language) const {
    return GetContent(language).GetText();
  }
private:
  std::string m_Language;
};

class PluginMetadata {
public:
  PluginMetadata(const loot::PluginMetadata &input, const std::string &language);

  void toJS(nbind::cbOutput output) const;

  std::string GetName() const {
    return m_Wrapped.GetName();
  }

  bool IsEnabled() const {
    return m_Wrapped.IsEnabled();
  }

  Priority GetGlobalPriority() const {
    return m_Wrapped.GetGlobalPriority();
  }

  Priority GetLocalPriority() const {
    return m_Wrapped.GetLocalPriority();
  }

  std::vector<Tag> GetTags() const {
    return transform<Tag>(m_Wrapped.GetTags());
  }

  std::vector<Message> GetMessages() const {
    const std::vector<loot::Message> messages = m_Wrapped.GetMessages();
    std::vector<Message> result;
    for (auto msg : messages) {
      result.push_back(Message(msg, m_Language));
    }
    return result;
  }

  std::vector<File> GetRequirements() const {
    return transform<File>(m_Wrapped.GetRequirements());
  }
 
  std::vector<File> GetIncompatibilities() const {
    return transform<File>(m_Wrapped.GetIncompatibilities());

  } 

  std::vector<File> GetLoadAfterFiles() const {
    return transform<File>(m_Wrapped.GetLoadAfterFiles());
  }

  std::vector<PluginCleaningData> GetCleanInfo() const {
    return transform<PluginCleaningData>(m_Wrapped.GetCleanInfo());
  }

  std::vector<PluginCleaningData> GetDirtyInfo() const {
    return transform<PluginCleaningData>(m_Wrapped.GetDirtyInfo());
  }

  std::vector<Location> GetLocations() const {
    return transform<Location>(m_Wrapped.GetLocations());
  }
private:
  loot::PluginMetadata m_Wrapped;
  std::string m_Language;
};

class Loot {

public:

  Loot(std::string gameId, std::string gamePath, std::string gameLocalPath, std::string language);

  bool updateMasterlist(std::string masterlistPath, std::string remoteUrl, std::string remoteBranch);

  MasterlistInfo getMasterlistRevision(std::string masterlistPath, bool getShortId) const;

  void loadLists(std::string masterlistPath, std::string userlistPath);

  PluginMetadata getPluginMetadata(std::string plugin);

  std::vector<std::string> sortPlugins(std::vector<std::string> input);

private:

  loot::GameType convertGameId(const std::string &gameId) const;

private:

  std::string m_Language;
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
  method(toJS);
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
  getter(GetName);
  getter(GetTags);
  getter(GetCleanInfo);
  getter(GetDirtyInfo);
  getter(GetGlobalPriority);
  getter(GetIncompatibilities);
  getter(GetLoadAfterFiles);
  getter(GetLocalPriority);
  getter(GetLocations);
  getter(GetRequirements);
  getter(GetMessages);
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
  construct<std::string, std::string, std::string, std::string>();
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
