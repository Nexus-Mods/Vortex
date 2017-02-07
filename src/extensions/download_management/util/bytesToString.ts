const labels = [ 'B', 'K', 'M', 'G', 'T' ];

function bytesToString(bytes: number): string {
  let labelIdx = 0;
  while (bytes > 1024) {
    ++labelIdx;
    bytes /= 1024;
  }
  return bytes.toFixed(1) + ' ' + labels[labelIdx];
}

export default bytesToString;
