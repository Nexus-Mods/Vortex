const ffi = require('ffi');
const ref = require('ref');

function TEXT(text) {
  return new Buffer(text, 'utf8').toString('binary');
}

const DWORD = 'uint32';
const LPWSTR = ref.types.CString;
const LPCWSTR = ref.types.CString;
const stringPtr = ref.refType(ref.types.CString);

const kernel32 = new ffi.Library('Kernel32', {
  GetPrivateProfileStringW: [DWORD, [LPCWSTR, LPCWSTR, LPCWSTR, LPWSTR, DWORD, LPCWSTR]],
  GetPrivateProfileSectionNamesA: [DWORD, [stringPtr, DWORD, ref.types.CString]],
  GetPrivateProfileSectionNamesW: [DWORD, [stringPtr, DWORD, ref.types.CString]],
  GetLastError: [DWORD, []],
});

let buf = new Buffer(1024);

let size = kernel32.GetPrivateProfileSectionNamesA(buf, 1024, TEXT('C:\\Users\\Tannin\\Documents\\my games\\FalloutNV\\Fallout.ini'));

console.log('err', kernel32.GetLastError());

console.log('size', size);
let offset = 0;
while (buf.readInt8(offset) !== 0) {
  let section = ref.readCString(buf, offset);
  console.log('sec', section);
  offset += section.length + 1;
}
