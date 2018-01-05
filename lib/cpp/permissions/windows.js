const ffi = require('ffi');
const path = require('path');
const ref = require('ref');
const StructType = require('ref-struct');
const wchar_t = require('./wchar');

const wcharString = wchar_t.string;
const BYTE = ref.types.uint8;
const WORD = ref.types.uint16;
const DWORD = ref.types.uint32;
const ULONG = ref.types.ulong;
const ENUM = ref.types.uint32;
const HANDLE = ref.refType(ref.types.void);
const SECURITY_INFORMATION = DWORD;
// unknown size
const PSID = ref.refType(ref.types.void);
const PPSID = ref.refType(PSID);

const ACL = StructType({
  AclRevision: BYTE,
  Sbz1: BYTE,
  AclSize: WORD,
  AceCount: WORD,
  Sbz2: WORD,
});

const PACL = ref.refType(ACL);
const PPACL = ref.refType(PACL);

const ACCESS_MODE = ref.types.uint32;

const TRUSTEE = StructType({
    pMultipleTrustee: ref.refType(ref.types.void),
    MultipleTrusteeOperation: ENUM,
    TrusteeForm: ENUM,
    TrusteeType: ENUM,
    ptstrName: ref.types.CString,
});

const PTRUSTEE = ref.refType(TRUSTEE);

const EXPLICIT_ACCESS = StructType({
  grfAccessPermissions: DWORD,
  grfAccessMode: ACCESS_MODE,
  grfInheritance: DWORD,
  Trustee: TRUSTEE,
});

const PEXPLICIT_ACCESS = ref.refType(EXPLICIT_ACCESS);

// unknown size
const PSECURITY_DESCRIPTOR = ref.refType(ref.types.void);
const PPSECURITY_DESCRIPTOR = ref.refType(PSECURITY_DESCRIPTOR);

let advapi = ffi.Library('Advapi32', {
  GetNamedSecurityInfoW: [DWORD, [
    wcharString, ENUM, SECURITY_INFORMATION,
    PPSID, PPSID, PPACL, PPACL, PPSECURITY_DESCRIPTOR,
  ]],
  SetNamedSecurityInfoW: [DWORD, [
    wcharString, ENUM, SECURITY_INFORMATION, PSID, PSID, PACL, PACL
  ]],
  SetEntriesInAclW: [DWORD, [
    ULONG, PEXPLICIT_ACCESS, PACL, PPACL,
  ]],
});

let kernel32 = ffi.Library('Kernel32.dll', {
  LocalFree: [HANDLE, [HANDLE]],
});

const GRANT_ACCESS = 1;
const SET_ACCESS = 2;
const DENY_ACCESS = 3;
const REVOKE_ACCESS = 4;
const SET_AUDIT_SUCCESS = 5;
const SET_AUDIT_FAILURE = 6;

const TRUSTEE_IS_SID = 0;
const TRUSTEE_IS_NAME = 1;
const TRUSTEE_BAD_FORM = 2;
const TRUSTEE_IS_OBJECTS_AND_SID = 3;
const TRUSTEE_IS_OBJECTS_AND_NAME = 4;

const NO_INHERITANCE = 0x00;
const SUB_OBJECTS_ONLY_INHERIT = 0x01;
const SUB_CONTAINERS_ONLY_INHERIT = 0x02;
const SUB_CONTAINERS_AND_OBJECTS_INHERIT = 0x03;
const INHERIT_NO_PROPAGATE = 0x04;
const INHERIT_ONLY = 0x08;
const INHERITED_ACCESS_ENTRY = 0x10;

const SE_FILE_OBJECT = 1;

const DACL_SECURITY_INFORMATION = 4;

function Grant(permissions, name) {
  return new EXPLICIT_ACCESS({
    grfAccessPermissions: permissions,
    grfAccessMode: GRANT_ACCESS,
    grfInheritance: SUB_CONTAINERS_AND_OBJECTS_INHERIT,
    Trustee: new TRUSTEE({
      TrusteeForm: TRUSTEE_IS_NAME,
      Name: name,
    }),
  });
}

function ApplyAccess(filePath, access) {
  let oldAcl;
  let secDesc;
  advapi.GetNamedSecurityInfoW(
    filePath,
    SE_FILE_OBJECT,
    DACL_SECURITY_INFORMATION,
    null,
    null,
    oldAcl,
    null,
    secDesc
  );

  kernel32.LocalFree(secDesc);

  let newAcl;
  advapi.SetEntriesInAclW(
    access,
    oldAcl,
    newAcl
  );

  advapi.SetNamedSecurityInfoW(
    filePath,
    SE_FILE_OBJECT,
    DACL_SECURITY_INFORMATION,
    null,
    null,
    newAcl,
    0
  );
}

module.exports = {
  Grant,
  ApplyAccess,
  DELETE: 0x00010000,
  READ_CONTROL: 0x000200000,
  WRITE_DAC: 0x00040000,
  WRITE_OWNER: 0x00080000,
  SYNCHRONIZE: 0x00100000,

  STANDARD_RIGHTS_REQUIRED: 0x000F0000,
  STANDARD_RIGHTS_READ: 0x000200000,
  STANDARD_RIGHTS_WRITE: 0x000200000,
  STANDARD_RIGHTS_EXECUTE: 0x000200000,
  STANDARD_RIGHTS_ALL: 0x001F0000,

  SPECIFIC_RIGHTS_ALL: 0x0000FFFF,

  GENERIC_ALL: 0x10000000,
  GENERIC_EXECUTE: 0x20000000,
  GENERIC_WRITE: 0x40000000,
  GENERIC_READ: 0x80000000,
}
