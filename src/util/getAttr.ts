function getAttr<T>(dict: any, key: string, def: T): T {
  if (dict === undefined) {
    return def;
  }

  return dict[key] !== undefined ? dict[key] : def;
}

export default getAttr;
