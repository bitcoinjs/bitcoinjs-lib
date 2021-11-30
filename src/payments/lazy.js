function prop (object, name, f) {
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

function value (f) {
  let value
  return function () {
    if (value !== undefined) return value
    value = f()
    return value
  }
}

module.exports = { prop, value }
