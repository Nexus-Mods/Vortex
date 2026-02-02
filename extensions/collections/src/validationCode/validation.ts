import validateAFJBaqeO from "./ICollection.validate";
export function validateICollection(data): any[] {
  var res = validateAFJBaqeO(data);
  return res === false ? validateAFJBaqeO.prototype.constructor.errors : [];
}
