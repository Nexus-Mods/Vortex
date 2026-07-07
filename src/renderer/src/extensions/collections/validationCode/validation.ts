import validateAFJBaqeO from "./ICollection.validate";
export function validateICollection(data): any[] {
  const res = validateAFJBaqeO(data);
  return res === false ? validateAFJBaqeO.prototype.constructor.errors : [];
}
