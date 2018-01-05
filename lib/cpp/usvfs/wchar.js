// wchar type. Based on ref-wchar but using iconv-lite instead
// of iconv and thus doesn't require a native module

const ref = require('ref');
const iconv = require('iconv-lite');

const size = process.platform === 'win32' ? 2 : 4;
const systemEnc = `UTF-${size * 8}${ref.endianness}`;

console.log(systemEnc);

function toString(buffer) {
  return iconv.decode(buffer, systemEnc);
}

function fromString(input) {
  return iconv.encode(input, systemEnc);
}

module.exports = Object.assign(Object.create(ref.types[`int${size * 8}`]), {
  name: 'wchar_t',
  size,
  indirection: 1,
  get: (buffer, offset) => {
    if ((offset > 0) || (buffer.length !== size)) {
      offset = offset | 0;
      buffer = buffer.slice(offset, offset + size);
    }
    return toString(buffer);
  },
  set: (buffer, offset, value) => {
    let temp = value;
    if (typeof value === 'string') {
      temp = fromString(value[0]);
    } else if (typeof value === 'number') {
      temp = fromString(String.fromCharCode(value));
    } else if ((value === undefined) || (value === null)) {
      throw new TypeError('expected string, number of Buffer');
    }
    temp.copy(buffer, offset, 0, size);
  },
  toString,
  string: Object.assign(Object.create(ref.types.CString), {
    name: 'WCString',
    get: (buffer, offset) => {
      const temp = buffer.readPointer(offset);
      return temp.isNull()
        ? null
        : toString(temp.reinterpretUntilZeros(size));
    },
    set: (buffer, offset, value) => {
      let temp = value;
      if (typeof value === 'string') {
        temp = fromString(value + '\0');
      }
      buffer.writePointer(temp, offset);
    }
  })
});
