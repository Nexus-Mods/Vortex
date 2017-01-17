
/**
 * convert the Game ID
 * 
 * @param {string} input
 * @return {string} input
 * 
 */

function convertGameId(input: string): string {
  if (input === 'skyrimse') {
    return 'skyrimspecialedition';
  } else {
    return input;
  }
}

export default convertGameId;
