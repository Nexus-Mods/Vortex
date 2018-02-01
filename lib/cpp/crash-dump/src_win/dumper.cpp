#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <DbgHelp.h>
#include <string>
#include <nan.h>
#include <fstream>
#include <ctime>
#include "string_cast.h"

using namespace Nan;
using namespace v8;

PVOID exceptionHandler = nullptr;

std::string dmpPath;
std::wstring dmpPathW;

void createMiniDump(std::ofstream &logFile, PEXCEPTION_POINTERS exceptionPtrs)
{
  typedef BOOL (WINAPI *FuncMiniDumpWriteDump)(HANDLE process, DWORD pid, HANDLE file, MINIDUMP_TYPE dumpType,
                                               const PMINIDUMP_EXCEPTION_INFORMATION exceptionParam,
                                               const PMINIDUMP_USER_STREAM_INFORMATION userStreamParam,
                                               const PMINIDUMP_CALLBACK_INFORMATION callbackParam);
  HMODULE dbgDLL = LoadLibraryW(L"dbghelp.dll");

  if (dbgDLL) {
    FuncMiniDumpWriteDump funcDump = reinterpret_cast<FuncMiniDumpWriteDump>(GetProcAddress(dbgDLL, "MiniDumpWriteDump"));
    if (funcDump) {
      HANDLE dumpFile = ::CreateFileW(dmpPathW.c_str(), GENERIC_WRITE, FILE_SHARE_WRITE, nullptr,
                                      CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);

      if (dumpFile != INVALID_HANDLE_VALUE) {
        _MINIDUMP_EXCEPTION_INFORMATION exceptionInfo;
        exceptionInfo.ThreadId = GetCurrentThreadId();
        exceptionInfo.ExceptionPointers = exceptionPtrs;
        exceptionInfo.ClientPointers = FALSE;

        logFile << "writing dump " << dmpPath << std::endl;

        BOOL success = funcDump(::GetCurrentProcess(), ::GetCurrentProcessId(), dumpFile, MiniDumpNormal,
                                &exceptionInfo, nullptr, nullptr);
        if (!success) { 
          logFile << "failed to write dump: " << ::GetLastError() << std::endl;
        } else {
          logFile << "success" << std::endl;
        }
        ::CloseHandle(dumpFile);
      } else {
        logFile << "failed to create dmp file: " << ::GetLastError() << std::endl;
      }
    } else {
      logFile << "wrong version of dbghelp.dll" << std::endl;
    }
    ::FreeLibrary(dbgDLL);
  } else {
    logFile << "dbghelp.dll not loaded: " << ::GetLastError() << std::endl;
  }
}

bool DoIgnore(DWORD code) {
  return (code == 0x80010012)  // some COM errors, seem to be windows internal
      || (code == 0x80010108)
      || (code == 0x8001010d)
      || (code == 0xe06d7363)  // cpp exception
      || (code == 0xe0434352)  // c# exception
  ;
}

LONG WINAPI VEHandler(PEXCEPTION_POINTERS exceptionPtrs)
{
  if (   (exceptionPtrs->ExceptionRecord->ExceptionCode  < 0x80000000)      // non-critical
      || DoIgnore(exceptionPtrs->ExceptionRecord->ExceptionCode)) {   // c# exception
    // don't report non-critical exceptions
    return EXCEPTION_CONTINUE_SEARCH;
  }

  if (exceptionPtrs->ExceptionRecord->ExceptionFlags != EXCEPTION_NONCONTINUABLE) {
    // we don't want to log continuable exceptions
    return EXCEPTION_CONTINUE_SEARCH;
  }

  std::ofstream logFile;
  logFile.open((dmpPath + ".log").c_str(), std::fstream::out | std::fstream::app);
  logFile << "Exception time: " << time(nullptr) << std::endl;
  logFile << "Exception code: " << std::hex << exceptionPtrs->ExceptionRecord->ExceptionCode << std::dec << std::endl;
  logFile << "Exception address: " << std::hex << exceptionPtrs->ExceptionRecord->ExceptionAddress << std::dec << std::endl;

  createMiniDump(logFile, exceptionPtrs);

  return EXCEPTION_CONTINUE_SEARCH;
}

NAN_METHOD(init) {
  String::Utf8Value path(info[0]->ToString());

  dmpPath = *path;
  dmpPathW = toWC(*path, CodePage::UTF8, path.length());

  if (exceptionHandler == nullptr) {
    exceptionHandler = ::AddVectoredExceptionHandler(0, VEHandler);
  }
}

NAN_METHOD(crash) {
  *(char*)0 = 0;
}

NAN_MODULE_INIT(Init) {
  Nan::Set(target, New<String>("init").ToLocalChecked(),
    GetFunction(New<FunctionTemplate>(init)).ToLocalChecked());
  Nan::Set(target, New<String>("crash").ToLocalChecked(),
    GetFunction(New<FunctionTemplate>(crash)).ToLocalChecked());
}

NODE_MODULE(dumper, Init)
