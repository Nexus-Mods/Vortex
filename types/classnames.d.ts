declare module 'classnames' {
  type ClassValue = string | number | ClassDictionary | ClassArray | undefined | null | boolean;

  interface ClassDictionary {
    [id: string]: any;
  }

  interface ClassArray extends Array<ClassValue> { }

  interface ClassNamesFn {
    (...classes: ClassValue[]): string;
  }

  const classNames: ClassNamesFn;

  export = classNames;
}