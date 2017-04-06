function convertGameId(input: string): string {
  let inputL = input.toLowerCase();
  if (inputL === 'skyrimse') {
    return 'skyrimspecialedition';
  } else if (inputL === 'falloutnv') {
    return 'newvegas';
  } else {
    return input;
  }
}

export default convertGameId;
