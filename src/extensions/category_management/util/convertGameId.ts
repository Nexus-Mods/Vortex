
export function convertGameId(input: string): string {
  if (input === 'skyrimse') {
    return 'skyrimspecialedition';
  } else {
    return input;
  }
}
