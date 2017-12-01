#pragma once

#include <string>
#include <vector>
#include <functional>

#include "optional.h"

static uint32_t FILE_ATTRIBUTE_TERMINATOR = 0x80000000;

struct Entry {
  Entry() {}
  Entry(const Entry &ref) {
    filePath = ref.filePath;
    attributes = ref.attributes;
    size = ref.size;
    mtime = ref.mtime;
    linkCount = ref.linkCount;
    id = ref.id;
  }
  std::wstring filePath;
  uint32_t attributes;
  uint64_t size;
  uint32_t mtime;
  Optional<uint32_t> linkCount;
  Optional<uint64_t> id;
};

struct WalkOptions {
  Optional<uint32_t> threshold;
  Optional<bool> terminators;
  Optional<bool> details;
  Optional<bool> recurse;
  Optional<bool> skipHidden;
};

void walk(const std::wstring &basePath,
          std::function<void(const std::vector<Entry> &results)> cb,
          const WalkOptions &options);
