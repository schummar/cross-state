export type TrackingProxy<T> = [value: T, equals: (newValue: T) => boolean];
type Object_ = Record<string | symbol, unknown>;

const NestedProxyKeys = ['get', 'getOwnPropertyDescriptor', 'ownKeys'] as const;
const SimpleProxyKeys = ['getPrototypeOf', 'has', 'isExtensible'] as const;

function isPlainObject(value: unknown) {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

export function trackingProxy<T>(value: T): TrackingProxy<T> {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return [value, (other) => other === value];
  }

  const deps = new Array<TrackingProxy<any>[1]>();

  const proxy = new Proxy(value as T & Object_, {
    ...Object.fromEntries(
      NestedProxyKeys.map((key) => [
        key,
        (currentValue: T & Object_, ...args: any[]) => {
          const function_ = Reflect[key] as any;
          const [proxiedValue, equals] = trackingProxy(function_(currentValue, ...args));

          deps.push((otherValue) => {
            if (!isPlainObject(otherValue) && !Array.isArray(otherValue)) {
              return false;
            }

            return equals(function_(otherValue, ...args));
          });

          return proxiedValue;
        },
      ]),
    ),

    ...Object.fromEntries(
      SimpleProxyKeys.map((key) => [
        key,
        (currentValue: T & Object_, ...args: any[]) => {
          const function_ = Reflect[key] as any;
          const value = function_(currentValue, ...args);

          deps.push((otherValue) => {
            return function_(otherValue, ...args) === value;
          });

          return value;
        },
      ]),
    ),
  });

  return [proxy, (other) => !!other && deps.every((equals) => equals(other))];
}
