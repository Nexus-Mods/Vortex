import uuidv5 from "uuid/v5";

/** The namespace record ids are derived in. Changing it changes every record id. */
const RECORD_ID_NAMESPACE = "6f0c1d52-3a8e-4b7f-9c41-2d5e8a7b3c90";

/**
 * The id a record is sent under. It follows from the feedback, the record's type and its key, so
 * sending the same feedback again sends the same ids and the API stores each record once.
 */
export function feedbackRecordId(feedbackId: string, type: string, key: string): string {
  return uuidv5(`${feedbackId}:${type}:${key}`, RECORD_ID_NAMESPACE);
}
