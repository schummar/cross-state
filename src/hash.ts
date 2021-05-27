export function hash(arg: unknown): string {
  return JSON.stringify({ arg }, (_key, value) => {
    if (value instanceof Object && !(value instanceof Array)) {
      const obj: any = {};
      for (const key of Object.keys(value).sort()) {
        obj[key] = value[key as keyof typeof value];
      }
      return obj;
    }
    return value;
  });
}
