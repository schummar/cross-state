export function toExtendedJson(value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __map: [...value].map(([k, v]) => [toExtendedJson(k), toExtendedJson(v)]),
    };
  }

  if (value instanceof Set) {
    return {
      __set: [...value].map(toExtendedJson),
    };
  }

  if (value instanceof Date) {
    return {
      __date: value.toISOString(),
    };
  }

  if (Array.isArray(value)) {
    return value.map(toExtendedJson);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toExtendedJson(v)]));
  }

  return value;
}

export function toExtendedJsonString(value: unknown): string {
  return JSON.stringify(toExtendedJson(value));
}

export function fromExtendedJson(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  if ('__map' in value) {
    return new Map(
      (value.__map as [unknown, unknown][]).map(([k, v]) => [
        fromExtendedJson(k),
        fromExtendedJson(v),
      ]),
    );
  }

  if ('__set' in value) {
    return new Set((value.__set as unknown[]).map(fromExtendedJson));
  }

  if ('__date' in value) {
    return new Date(value.__date as string);
  }

  if (Array.isArray(value)) {
    return value.map(fromExtendedJson);
  }

  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromExtendedJson(v)]));
}

export function fromExtendedJsonString(value: string): unknown {
  return fromExtendedJson(JSON.parse(value));
}
