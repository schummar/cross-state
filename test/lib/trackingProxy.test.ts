import { describe, expect, test } from 'vitest';
import { trackingProxy } from '../../src/lib/trackingProxy';

describe('trackingProxy', () => {
  test('using nothing', () => {
    const [, equals] = trackingProxy({ a: 1, b: 2 });

    expect(equals({ a: 2, b: 3 })).toBe(true);
  });

  test('using one', () => {
    const [proxy, equals] = trackingProxy({ a: 1, b: 2 });
    const _a = proxy.a;

    expect(equals({ a: 2, b: 2 })).toBe(false);
    expect(equals({ a: 1, b: 3 })).toBe(true);
  });

  test('using one in array', () => {
    const [proxy, equals] = trackingProxy([1, 2]);
    const _a = proxy[0];

    expect(equals([2, 2])).toBe(false);
    expect(equals([1, 3])).toBe(true);
  });

  test('ownKeys', () => {
    const [proxy, equals] = trackingProxy({ a: 1, b: 2 });
    const _keys = Reflect.ownKeys(proxy);

    expect(equals({ a: 2, b: 3 })).toBe(true);
    expect(equals({ a: 1, b: 2, c: 3 } as any)).toBe(false);
  });

  test(`bug: TypeError: 'get' on proxy: property 'a' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value`, () => {
    const [proxy] = trackingProxy(Object.freeze({ a: {} }));
    expect(() => proxy.a).not.toThrow();
  });

  test(`bug: TypeError: 'getOwnPropertyDescriptor' on proxy: trap returned descriptor for property 'a' that is incompatible with the existing property in the proxy target`, () => {
    const [proxy] = trackingProxy(Object.freeze({ a: {} }));

    Object.getOwnPropertyDescriptor(proxy, 'a');
  });
});
