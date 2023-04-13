import { deepEqual } from './equals';

const unwrapProxySymbol = /* @__PURE__ */ Symbol('unwrapProxy');

export type TrackingProxy<T> = [value: T, equals: (newValue: T) => boolean, revoke?: () => void];
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

  // Unpack proxies, we don't want to nest them
  value = (value as any)[unwrapProxySymbol] ?? value;

  const deps = new Array<TrackingProxy<any>[1]>();
  const revokations = new Array<() => void>();
  let revoked = false;

  function trackComplexProp(function_: any, ...args: any[]) {
    const [proxiedValue, equals, revoke] = trackingProxy(function_(value, ...args));

    deps.push((otherValue) => {
      if (!isPlainObject(otherValue) && !Array.isArray(otherValue)) {
        return false;
      }

      return equals(function_(otherValue, ...args));
    });

    if (revoke) {
      revokations.push(revoke);
    }

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
      if (p === unwrapProxySymbol) {
        return value;
      }

      if (revoked) {
        return target[p];
      }

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

  return [
    proxy,
    (other) => !!other && deps.every((equals) => equals(other)),
    () => {
      revoked = true;
      revokations.forEach((revoke) => revoke());
    },
  ];
}
