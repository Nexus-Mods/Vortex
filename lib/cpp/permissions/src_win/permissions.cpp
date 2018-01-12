#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <aclapi.h>
#include <string>
#include <sstream>
#include <vector>
#include <nbind/api.h>

#include "scopeguard.h"
#include "string_cast.h"

class Access {
public:
  Access(Access &reference)
    : mAccess(reference.mAccess), mSid(reference.mSid)
  {
    reference.mOwner = false;
  }

  Access &operator=(const Access&) = delete;

  static Access grant(const std::string &group, const std::string &permission) {
    return Access(GRANT_ACCESS, group, permission);
  }

  static Access deny(const std::string &group, const std::string &permission) {
    return Access(DENY_ACCESS, group, permission);
  }

  ~Access() {
    if (mOwner) {
      LocalFree(mSid);
    }
  }

  PEXPLICIT_ACCESSW operator*() {
    return &mAccess;
  }
private:
  Access(ACCESS_MODE mode, const std::string &group, const std::string &permission) {
    mAccess.grfAccessMode = mode;
    mAccess.grfAccessPermissions = translatePermission(permission);
    mAccess.grfInheritance = SUB_CONTAINERS_AND_OBJECTS_INHERIT;
    mAccess.Trustee = makeTrustee(group);
  }

  WELL_KNOWN_SID_TYPE translateGroup(const std::string &group) {
    if (group == "everyone") {
      return WinAuthenticatedUserSid;
    }
    else if (group == "owner") {
      return WinCreatorOwnerSid;
    }
    else if (group == "group") {
      return WinBuiltinUsersSid;
    }
    else if (group == "guest") {
      return WinBuiltinGuestsSid;
    }
    else if (group == "administrator") {
      return WinBuiltinAdministratorsSid;
    }
    throw std::runtime_error("invalid user group");
  }

  DWORD translatePermission(const std::string &rights) {
    static auto sPermissions = std::vector<std::pair<char, DWORD>>({
        std::make_pair('r', FILE_GENERIC_READ),
        std::make_pair('w', FILE_WRITE_DATA | FILE_WRITE_ATTRIBUTES |
                                FILE_WRITE_EA | FILE_APPEND_DATA | SYNCHRONIZE),
        std::make_pair('x', FILE_GENERIC_READ | FILE_GENERIC_EXECUTE),
    });

    DWORD res = 0;
    for (auto kv : sPermissions) {
      if (rights.find_first_of(kv.first) != std::string::npos) {
        res |= kv.second;
      }
    }
    return res;
  }

  TRUSTEEW makeTrustee(const std::string &group) {
    DWORD sidSize = SECURITY_MAX_SID_SIZE;
    mSid = LocalAlloc(LMEM_FIXED, sidSize);
    if (mSid == nullptr) {
      throw std::runtime_error("allocation error");
    }
    if (!CreateWellKnownSid(translateGroup(group), nullptr, mSid, &sidSize)) {
      std::ostringstream err;
      err << "Failed to create sid from group \"" << group << "\": " << ::GetLastError();
      throw std::runtime_error(err.str());
    }

    TRUSTEEW res;
    res.MultipleTrusteeOperation = NO_MULTIPLE_TRUSTEE;
    res.pMultipleTrustee = nullptr;
    res.TrusteeForm = TRUSTEE_IS_SID;
    res.TrusteeType = TRUSTEE_IS_WELL_KNOWN_GROUP;
    res.ptstrName = reinterpret_cast<LPWSTR>(mSid);
    return res;
  }
private:
  bool mOwner { true };
  EXPLICIT_ACCESSW mAccess;
  PSID mSid;
};

void apply(Access &access, const std::string &path) {
  std::wstring wpath = toWC(path.c_str(), CodePage::UTF8, path.size());

  PACL oldAcl;
  PSECURITY_DESCRIPTOR secDesc;
  DWORD res = GetNamedSecurityInfoW(
    wpath.c_str(), SE_FILE_OBJECT, DACL_SECURITY_INFORMATION,
    nullptr, nullptr, &oldAcl, nullptr, &secDesc);
  if (res != ERROR_SUCCESS) {
    std::ostringstream err;
    err << "Failed to get ACL: " << res;
    NBIND_ERR(err.str().c_str());
    return;
  }

  ON_BLOCK_EXIT([&] () {
    LocalFree(secDesc);
  });

  PACL newAcl;

  res = SetEntriesInAclW(1, *access, oldAcl, &newAcl);
  if (res != ERROR_SUCCESS) {
    std::ostringstream err;
    err << "Failed to change ACL: " << res;
    NBIND_ERR(err.str().c_str());
    return;
  }

  ON_BLOCK_EXIT([&] () {
    LocalFree(newAcl);
  });

  // SetNamedSecurityInfo expects a non-const point to the path, but there is
  // no indication that it may actually get changed, much less that we need
  // to provide a larger buffer than necessary to hold the string
  res = SetNamedSecurityInfoW(&wpath[0], SE_FILE_OBJECT,
                              DACL_SECURITY_INFORMATION, nullptr, nullptr,
                              newAcl, nullptr);

  if (res != ERROR_SUCCESS) {
    std::ostringstream err;
    err << "Failed to apply ACL: " << res;
    NBIND_ERR(err.str().c_str());
    return;
  }
}

#include <nbind/nbind.h>
 
NBIND_CLASS(Access) {
  method(grant);
  method(deny);
}

NBIND_GLOBAL() {
  function(apply);
}
