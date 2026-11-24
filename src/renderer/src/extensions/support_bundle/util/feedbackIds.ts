/** Crockford's base32: no I, L, O or U, so an id survives being read out or typed in. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const TIME_LENGTH = 7;
const RANDOM_LENGTH = 9;

/** What a feedback id looks like, as the API also checks it. */
export const FEEDBACK_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

/**
 * A new feedback id, the one the user is shown and can quote: sixteen base32 characters in four
 * groups. The first seven are the Unix time in seconds, so ids made later sort later, as text; the
 * other nine are random, which is what tells apart feedbacks created in the same second.
 */
export function newFeedbackId(
  now: number = Date.now(),
  fillRandom: (bytes: Uint8Array<ArrayBuffer>) => void = (bytes) => {
    crypto.getRandomValues(bytes);
  },
): string {
  let seconds = Math.floor(now / 1000);
  let time = "";
  for (let index = 0; index < TIME_LENGTH; index++) {
    // by division, since bitwise operators stop at 32 bits and seven characters hold 35
    time = ALPHABET[seconds % 32]! + time;
    seconds = Math.floor(seconds / 32);
  }

  const bytes = new Uint8Array(RANDOM_LENGTH);
  fillRandom(bytes);
  // five bits of each byte: a whole character, with every character as likely as the next
  const random = Array.from(bytes, (byte) => ALPHABET[byte & 31]).join("");

  return (time + random).match(/.{4}/g)!.join("-");
}
