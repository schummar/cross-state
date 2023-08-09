export const autobind = <
  TClass extends abstract new (...args: any) => any = abstract new (...args: any) => any,
>(
  _class: TClass,
  _context?: ClassDecoratorContext<TClass>,
) => {
  if (Reflect.getOwnPropertyDescriptor(_class.prototype, '__autobind_done__')) {
    return _class;
  }
  Reflect.defineProperty(_class.prototype, '__autobind_done__', { value: true });

  for (const key of Reflect.ownKeys(_class.prototype)) {
    if (key === 'constructor') {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(_class.prototype, key);

    // Only methods need binding
    if (typeof descriptor?.value === 'function') {
      let method = descriptor.value as (...args: any[]) => any;
      let isBinding = false;

      Object.defineProperty(_class.prototype, key, {
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
          isBinding = true;

          Object.defineProperty(this, key, {
            configurable: true,
            get() {
              return boundMethod;
            },
            set(v) {
              method = v;
              //   delete this[key];
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
  }

  return _class;
};
