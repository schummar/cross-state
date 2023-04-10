import { deepEqual } from './equals';

export type TrackingProxy<T> = [value: T, equals: (newValue: T) => boolean];
type Object_ = Record<string | symbol, unknown>;

function isPlainObject(value: unknown) {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

export function trackingProxy<T>(value: T, equals = deepEqual): TrackingProxy<T> {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return [value, (other) => equals(value, other)];
  }

  const deps = new Array<TrackingProxy<any>[1]>();

  function trackComplexProp(function_: any, ...args: any[]) {
    const [proxiedValue, equals] = trackingProxy(function_(value, ...args));

    deps.push((otherValue) => {
      if (!isPlainObject(otherValue) && !Array.isArray(otherValue)) {
        return false;
      }

      return equals(function_(otherValue, ...args));
    });

    return proxiedValue;
  }

  function trackSimpleProp(function_: any, ...args: any[]) {
    const calculatedValue = function_(value, ...args);

    deps.push((otherValue) => {
      return function_(otherValue, ...args) === calculatedValue;
    });

    return calculatedValue;
  }

  const proxy = new Proxy(value as T & Object_, {
    get(target, p, receiver) {
      const { writable, configurable } = Object.getOwnPropertyDescriptor(target, p) ?? {};
      if (writable === false && configurable === false) {
        return target[p];
      }

      return trackComplexProp(Reflect.get, p, receiver);
    },

    getOwnPropertyDescriptor(target, p) {
      const { writable, configurable } = Object.getOwnPropertyDescriptor(target, p) ?? {};
      if (writable === false && configurable === false) {
        return Reflect.getOwnPropertyDescriptor(target, p);
      }

      return trackComplexProp(Reflect.getOwnPropertyDescriptor, p);
    },

    ownKeys() {
      return trackComplexProp(Reflect.ownKeys);
    },

    getPrototypeOf() {
      return trackSimpleProp(Reflect.getPrototypeOf);
    },

    has(_target, p) {
      return trackSimpleProp(Reflect.has, p);
    },

    isExtensible() {
      return trackSimpleProp(Reflect.isExtensible);
    },
  });

  return [proxy, (other) => !!other && deps.every((equals) => equals(other))];
}
