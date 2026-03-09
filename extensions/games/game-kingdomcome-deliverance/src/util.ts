export function transformId(modId: string) {
  return modId.replace(/[ -.]/g, '');
}
