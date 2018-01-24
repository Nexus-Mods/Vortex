function attachBindings(binding) {
  binding.bind('PluginMetadata',
               function(name, messages, tags, cleanInfo, dirtyInfo,
                        globalPriority, localPriority,
                        incompatibilities, loadAfterFiles, locations,
                        requirements, isEnabled) {
                 this.name = name;
                 this.messages = messages;
                 this.tags = tags;
                 this.cleanInfo = cleanInfo;
                 this.dirtyInfo = dirtyInfo;
                 this.globalPriority = globalPriority[0];
                 this.localPriority = localPriority[0];
                 this.incompatibilities = incompatibilities;
                 this.loadAfterFiles = loadAfterFiles;
                 this.locations = locations;
                 this.requirements = requirements;
                 this.isEnabled = isEnabled;
               });

  binding.bind('Message', function(type, value) {
    this.type = type;
    this.value = value;
  });

  binding.bind('File', function(name, displayName) {
    this.name = name;
    this.displayName = displayName;
  });

  binding.bind('Priority', function(value, isExplicit) {
    this.value = value;
    this.isExplicit = isExplicit;
  });

  binding.bind('MasterlistInfo', function(revisionId, revisionDate, isModified) {
    this.revisionId = revisionId;
    this.revisionDate = revisionDate;
    this.isModified = isModified;
  });

  binding.bind('Tag', function(name, isAddition, isConditional, condition) {
    this.name = name;
    this.isAddition = isAddition;
    this.isConditional = isConditional;
    this.condition = condition;
  });

  binding.bind('MessageContent', function(text) {
    this.text = text;
  });

  binding.bind('Location', function(name, url) {
    this.name = name;
    this.url = url;
  });

  binding.bind('PluginCleaningData', function(cleaningUtility, crc, deletedNavmeshCount, deletedReferenceCount,
                                              itmCount, info) {
    this.cleaningUtility = cleaningUtility;
    this.crc = crc;
    this.deletedNavmeshCount = deletedNavmeshCount;
    this.deletedReferenceCount = deletedReferenceCount;
    this.itmCount = itmCount;
    this.info = info;
  });
}

module.exports = attachBindings;
