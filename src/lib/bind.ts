export function bind(self: any) {
  for (const key of Reflect.ownKeys(self)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(self, key);
    if (descriptor?.value === 'function') {
      self[key] = self[key].bind(self);
    }
  }
}
