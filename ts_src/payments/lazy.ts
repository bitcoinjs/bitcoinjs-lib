export function prop(object: {}, name: string, f: () => any): void {
  Object.defineProperty(object, name, {
    configurable: true,
    enumerable: true,
    get(): any {
      const _value = f.call(this);
      this[name] = _value;
      return _value;
    },
    set(_value: any): void {
      Object.defineProperty(this, name, {
        configurable: true,
        enumerable: true,
        value: _value,
        writable: true,
      });
    },
  });
}

export function value<T>(f: () => T): () => T {
  let _value: T;
  return (): T => {
    if (_value !== undefined) return _value;
    _value = f();
    return _value;
  };
}
