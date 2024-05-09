const marker = Symbol('autobind');

export const autobind = <
  TClass extends abstract new (...args: any) => any = abstract new (...args: any) => any,
>(
  _class: TClass,
): TClass => {
  for (const key of Reflect.ownKeys(_class.prototype)) {
    if (key === 'constructor') {
      continue;
    }

    const descriptor = Reflect.getOwnPropertyDescriptor(_class.prototype, key);
    let method = descriptor?.get?.() ?? descriptor?.value;
    let isBinding = false;

    if (typeof method !== 'function' || method[marker]) {
      continue;
    }

    Reflect.defineProperty(_class.prototype, key, {
      configurable: true,
      get() {
        if (
          isBinding ||
          this === _class.prototype ||
          Object.prototype.hasOwnProperty.call(this, key) ||
          typeof method !== 'function'
        ) {
          return method;
        }

        const boundMethod = (...args: any[]) => Reflect.apply(method, this, args);
        boundMethod[marker] = true;
        isBinding = true;

        Object.defineProperty(this, key, {
          configurable: true,
          get() {
            return boundMethod;
          },
        });

        isBinding = false;
        return boundMethod;
      },
      set(v) {
        method = v;
      },
    });
  }

  return _class;
};
