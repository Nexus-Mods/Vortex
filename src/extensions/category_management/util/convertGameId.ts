
export function convertGameId(input: string): string {
  if (input === 'SkyrimSE') {
    return 'skyrimspecialedition';
  } else {
    return input;
  }
}
