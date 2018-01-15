#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <DbgHelp.h>
#include <string>
#include <nan.h>
#include "string_cast.h"

using namespace Nan;
using namespace v8;

PVOID exceptionHandler = nullptr;

std::wstring dmpPath;

// TODO: no logging or error reporting atm

void createMiniDump(PEXCEPTION_POINTERS exceptionPtrs)
{
  typedef BOOL (WINAPI *FuncMiniDumpWriteDump)(HANDLE process, DWORD pid, HANDLE file, MINIDUMP_TYPE dumpType,
                                               const PMINIDUMP_EXCEPTION_INFORMATION exceptionParam,
                                               const PMINIDUMP_USER_STREAM_INFORMATION userStreamParam,
                                               const PMINIDUMP_CALLBACK_INFORMATION callbackParam);
  HMODULE dbgDLL = LoadLibraryW(L"dbghelp.dll");

  static const int errorLen = 200;
  char errorBuffer[errorLen + 1];
  memset(errorBuffer, '\0', errorLen + 1);

  if (dbgDLL) {
    FuncMiniDumpWriteDump funcDump = reinterpret_cast<FuncMiniDumpWriteDump>(GetProcAddress(dbgDLL, "MiniDumpWriteDump"));
    if (funcDump) {
      HANDLE dumpFile = ::CreateFileW(dmpPath.c_str(), GENERIC_WRITE, FILE_SHARE_WRITE, nullptr,
                                      CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);

      if (dumpFile != INVALID_HANDLE_VALUE) {
        _MINIDUMP_EXCEPTION_INFORMATION exceptionInfo;
        exceptionInfo.ThreadId = GetCurrentThreadId();
        exceptionInfo.ExceptionPointers = exceptionPtrs;
        exceptionInfo.ClientPointers = FALSE;

        BOOL success = funcDump(::GetCurrentProcess(), ::GetCurrentProcessId(), dumpFile, MiniDumpNormal,
                                &exceptionInfo, nullptr, nullptr);
        ::CloseHandle(dumpFile);
      }
    }
    ::FreeLibrary(dbgDLL);
  }
}


LONG WINAPI VEHandler(PEXCEPTION_POINTERS exceptionPtrs)
{
  if (   (exceptionPtrs->ExceptionRecord->ExceptionCode  < 0x80000000)      // non-critical
      || (exceptionPtrs->ExceptionRecord->ExceptionCode == 0xe06d7363)) {   // cpp exception
    // don't report non-critical exceptions
    return EXCEPTION_CONTINUE_SEARCH;
  }

  if (::RemoveVectoredExceptionHandler(exceptionHandler) == 0) {
    return EXCEPTION_CONTINUE_SEARCH;
  }

  createMiniDump(exceptionPtrs);

  return EXCEPTION_CONTINUE_SEARCH;
}

NAN_METHOD(init) {
  String::Utf8Value path(info[0]->ToString());

  dmpPath = toWC(*path, CodePage::UTF8, path.length());

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
