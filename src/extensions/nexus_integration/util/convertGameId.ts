/**
 * convert the game id from either our internal format or the format
 * used in NXM links to the format used in the nexus api.
 * TODO: This works only as one function because our internal id so
 *   far coincides with the nxm link format except for upper/lower case.
 *   This should be two functions!
 */

export function convertGameId(input: string): string {
  const inputL = input.toLowerCase();
  if (inputL === 'skyrimse') {
    return 'skyrimspecialedition';
  } else if (inputL === 'falloutnv') {
    return 'newvegas';
  } else {
    return input;
  }
}

export function toNXMId(input: string): string {
  const inputL = input.toLowerCase();
  if (inputL === 'skyrimse') {
    return 'SkyrimSE';
  } else {
    return input;
  }
}
