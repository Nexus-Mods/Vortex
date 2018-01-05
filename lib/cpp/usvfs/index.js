const ffi = require('ffi');
const path = require('path');
const ref = require('ref');
const StructType = require('ref-struct');
const wchar_t = require('./wchar');

const WORD = ref.types.uint16;
const DWORD = ref.types.uint32;
const HANDLE = ref.refType(ref.types.void);
const stringPtr = ref.refType(ref.types.CString);
const wcharString = wchar_t.string;

const USVFSParameters = StructType({
  instanceName: stringPtr,
  currentSHMName: stringPtr,
  currentInverseSHMName: stringPtr,
  debugMode: ref.types.bool,
  logLevel: ref.types.uint8,
});

const USVFSParametersPtr = ref.refType(USVFSParameters);

const StartupInfo = StructType({
  cb: DWORD,
  lpReserved: ref.refType(ref.types.void),
  lpDesktop: ref.refType(ref.types.void),
  lpTitle: ref.refType(ref.types.void),
  dwX: DWORD,
  dwY: DWORD,
  dwXSize: DWORD,
  dwYSize: DWORD,
  dwXCountChars: DWORD,
  dwYCountChars: DWORD,
  dwFillAttribute: DWORD,
  dwFlags: DWORD,
  wShowWindow: WORD,
  cbReserved2: WORD,
  lpReserved2: HANDLE,
  hStdInput: HANDLE,
  hStdOutput: HANDLE,
  hStdError: HANDLE,
});

const StartupInfoPtr = ref.refType(StartupInfo);

const ProcessInfo = StructType({
  hProcess: HANDLE,
  hThread: HANDLE,
  dwProcessId: DWORD,
  dwThreadId: DWORD,
});

const ProcessInfoPtr = ref.refType(ProcessInfo);

let usvfs;
try {
  usvfs = ffi.Library(path.join(__dirname, 'usvfs_x64.dll'), {
    USVFSInitParameters: ['void', [USVFSParametersPtr, 'string', 'bool', 'int']],
    ConnectVFS: ['bool', [USVFSParametersPtr]],
    DisconnectVFS: ['void', []],
    ClearVirtualMappings: ['void', []],
    VirtualLinkDirectoryStatic: ['bool', [wcharString, wcharString, 'int']],
    VirtualLinkFile: ['bool', [wcharString, wcharString, 'int']],
    CreateProcessHooked: ['bool', [wcharString, wcharString, 'pointer', 'pointer', 'bool', 'int',
                                   'pointer', wcharString, StartupInfoPtr, ProcessInfoPtr]],
  });
} catch (err) {
  console.error('failed to load usvfs', require('util').inspect(err));
  process.exit(1);
}

function createVFS(params) {
  const par = new USVFSParameters();
  console.log(params);

  usvfs.USVFSInitParameters(par.ref(), params.instanceName, params.debugMode, params.logLevel);
  return usvfs.ConnectVFS(par.ref());
}

function connectVFS(params) {
  const par = new USVFSParameters();

  usvfs.USVFSInitParameters(par, params.instanceName, params.debugMode, params.logLevel);
  return usvfs.ConnectVFS(par);
}

function clearMappings() {
  usvfs.ClearVirtualMappings();
}

function linkFlags(parameters) {
  return parameters.failIfExists === true ? 1 : 0
       | parameters.monitorChanges === true ? 2 : 0
       | parameters.createTarget === true ? 4 : 0
       | parameters.recursive === true ? 8 : 0;
}

function linkFile(source, destination, parameters) {
  return usvfs.VirtualLinkFile(source, destination, linkFlags(parameters));
}

function linkDirectory(source, destination, parameters) {
  return usvfs.VirtualLinkFile(source, destination, linkFlags(parameters));
}

function disconnectVFS() {
  usvfs.DisconnectVFS();
}

function spawn(command, args, options) {
  const si = new StartupInfo({
    lpReserved: null,
    lpDesktop: null,
    lpTitle: null,
    lpReserved2: null,
    hStdInput: null,
    hStdOutput: null,
    hStdError: null,
  });

  const pi = new ProcessInfo({
    hProcess: null,
    hThread: null,
  });

  console.log('exec', command, options);

  usvfs.CreateProcessHooked(null, command + ' ' + args.join(' '), null, null, false,
                            0x01000000, null, options.cwd || null, si.ref(), pi.ref());
}

module.exports = {
  createVFS,
  connectVFS,
  clearMappings,
  linkFile,
  linkDirectory,
  disconnectVFS,
  spawn,
};

/*
63   3E 00080420 BlacklistExecutable
64   3F 000804D0 ClearVirtualMappings
66   41 000482A0 CreateHookContext
67   42 000808C0 CreateMiniDump
68   43 00080950 CreateProcessHooked
70   45 00080F60 CreateVFSDump
72   47 00081C40 GetCurrentVFSName
73   48 00081C90 GetLogMessages
74   49 00081D30 GetVFSProcessList
75   4A 00081E90 InitHooks
76   4B 00082820 InitLogging
77   4C 00082830 PrintDebugInfo
79   4E 00083370 USVFSUpdateParams
*/
