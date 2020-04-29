declare namespace validate {
  interface ErrorObject {
    keyword: string;
    dataPath: string;
    schemaPath: string;
    params: ErrorParameters;
    // Added to validation errors of propertyNames keyword schema
    propertyName?: string;
    // Excluded if messages set to false.
    message?: string;
    // These are added with the `verbose` option.
    schema?: any;
    parentSchema?: object;
    data?: any;
  }

  const errors: ErrorObject[];
}

declare function validate(input: any): boolean;
export = validate;
