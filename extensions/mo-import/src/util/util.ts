import path from 'path';
export function joinPaths(lhs: string, rhs: string) {
  // Well this feels silly...
  return path.join(lhs, rhs);
}