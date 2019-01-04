export function prop (object: Object, name: string, f: ()=>any): void {
  Object.defineProperty(object, name, {
    configurable: true,
    enumerable: true,
    get: function () {
      let value = f.call(this)
      this[name] = value
      return value
    },
    set: function (value) {
      Object.defineProperty(this, name, {
        configurable: true,
        enumerable: true,
        value: value,
        writable: true
      })
    }
  })
}

export function value <T> (f: ()=>T): ()=>T {
  let value: T
  return function (): T {
    if (value !== undefined) return value
    value = f()
    return value
  }
}
