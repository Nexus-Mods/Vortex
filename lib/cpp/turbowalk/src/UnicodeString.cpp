#include "UnicodeString.h"

UnicodeString::UnicodeString()
{
  m_Data.Length = m_Data.MaximumLength = 0;
  m_Data.Buffer = nullptr;
}


UnicodeString::UnicodeString(HANDLE fileHandle)
{
  setFromHandle(fileHandle);
}


UnicodeString::UnicodeString(LPCWSTR string, size_t length)
{
  if (length == std::string::npos) {
    length = wcslen(string);
  }
  m_Buffer.resize(length);
  memcpy(&m_Buffer[0], string, length * sizeof(WCHAR));
  update();
}


size_t UnicodeString::size() const {
  return m_Buffer.size() > 0 ? m_Buffer.size() - 1 : 0;
}

void UnicodeString::resize(size_t minSize) {
  m_Buffer.resize(minSize);
}

UnicodeString &UnicodeString::appendPath(PUNICODE_STRING path) {
  if (path != nullptr) {
    if (size() > 0) {
      m_Buffer.pop_back(); // zero termination
      m_Buffer.push_back(L'\\');
    }
    m_Buffer.insert(m_Buffer.end(), path->Buffer,
                    path->Buffer + (path->Length / sizeof(WCHAR)));
    update();
  }
  return *this;
}

void UnicodeString::set(LPCWSTR path) {
  m_Buffer.clear();
  static wchar_t Preamble[] = LR"(\??\)";
  m_Buffer.insert(m_Buffer.end(), Preamble, Preamble + 4);
  m_Buffer.insert(m_Buffer.end(), path, path + wcslen(path));
  update();
}

void UnicodeString::update() {
  while ((m_Buffer.size() > 0) && (*m_Buffer.rbegin() == L'\0')) {
    m_Buffer.resize(m_Buffer.size() - 1);
  }
  m_Data.Length = static_cast<USHORT>(m_Buffer.size() * sizeof (WCHAR));
  m_Data.MaximumLength = static_cast<USHORT>(m_Buffer.capacity() * sizeof(WCHAR));
  m_Buffer.push_back(L'\0');
}

void UnicodeString::setFromHandle(HANDLE fileHandle)
{
  if (m_Buffer.size() < 128) {
    m_Buffer.resize(128);
  }

  SetLastError(0UL);
  DWORD res = GetFinalPathNameByHandleW(fileHandle, &m_Buffer[0],
                                        static_cast<DWORD>(m_Buffer.size()),
                                        FILE_NAME_NORMALIZED);
  if (res == 0) {
    m_Buffer.resize(0);
  } else if (res > m_Buffer.size()) {
    m_Buffer.resize(res);
    GetFinalPathNameByHandleW(fileHandle, &m_Buffer[0], res, FILE_NAME_NORMALIZED);
  }

  update();
}

UnicodeString::operator LPCWSTR() const {
  return m_Buffer.data();
}

UnicodeString::operator PUNICODE_STRING() {
  m_Data.Buffer = &m_Buffer[0];
  return &m_Data;
}
