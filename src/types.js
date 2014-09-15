module.exports = function enforce(type, value) {
  switch (type) {
    // http://jsperf.com/array-typecheck-2
    case 'Array': {
      if (value != null && value.constructor === Array) return
      break
    }

    // http://jsperf.com/boolean-typecheck
    case 'Boolean': {
      if (typeof value === 'boolean') return
      break
    }

    case 'Buffer': {
      if (Buffer.isBuffer(value)) return
      break
    }

    // http://jsperf.com/number-constructor-v-isnan
    case 'Number': {
      if (typeof value === 'number') return
      break
    }

    // http://jsperf.com/string-typecheck-2
    case 'String': {
      if (value != null && value.constructor === String) return
      break
    }

    default: {
      if (value instanceof type) return
    }
  }

  throw new TypeError('Expected ' + (type.name || type) + ', got ' + value)
}
