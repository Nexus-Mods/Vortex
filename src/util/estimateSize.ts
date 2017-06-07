function estimateSize(object: any) {
  const visited = new Set<any>();
  const stack = [object];
  let bytes = 0;

  while (stack.length > 0) {
    const value = stack.pop();

    if (typeof value === 'boolean') {
      bytes += 4;
    } else if (typeof value === 'string') {
      bytes += value.length * 2;
    } else if (typeof value === 'number') {
      bytes += 8;
    } else if (value == null) {
      /* nop */
    } else if ((typeof value === 'object') && !visited.has(value)) {
      visited.add(value);

      Object.keys(value).forEach((key: string) => {
        if (value.hasOwnProperty(key)) {
          stack.push(value[key]);
        }
      });
    }
  }
  return bytes;
}

export default estimateSize;
