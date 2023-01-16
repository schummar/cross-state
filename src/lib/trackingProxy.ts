export type TrackingProxy<T> = [value: T, equals: (newValue: T) => boolean];
type Obj = Record<string | symbol, unknown>;

const ProxyKeys = ['get', 'getOwnPropertyDescriptor', 'getPrototypeOf', 'has', 'isExtensible', 'ownKeys'] as const;

const isPlainObject = (value: unknown) => typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

export function trackingProxy<T>(value: T): TrackingProxy<T> {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return [value, (other) => other === value];
  }

  const deps = new Array<TrackingProxy<any>[1]>();

  const proxy = new Proxy(
    value as T & Obj,
    Object.fromEntries(
      ProxyKeys.map((key) => [
        key,
        (value: T & Obj, ...args: any[]) => {
          const fn = Reflect[key] as any;
          const [proxiedValue, equals] = trackingProxy(fn(value, ...args));

          deps.push((otherValue) => {
            if (!isPlainObject(otherValue) && !Array.isArray(otherValue)) {
              return false;
            }

            return equals(fn(otherValue, ...args));
          });

          return proxiedValue;
        },
      ])
    )
  );

  return [proxy, (other) => !!other && deps.every((equals) => equals(other))];
}
