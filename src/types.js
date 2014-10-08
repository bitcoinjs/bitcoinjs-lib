module.exports = function enforce(type, value) {
  switch (type) {
    case 'Array': {
      if (Array.isArray(value)) return
      break
    }

    case 'Boolean': {
      if (typeof value === 'boolean') return
      break
    }

    case 'Buffer': {
      if (Buffer.isBuffer(value)) return
      break
    }

    case 'Number': {
      if (typeof value === 'number') return
      break
    }

    case 'String': {
      if (typeof value === 'string') return
      break
    }

    default: {
      if (getName(value.constructor) === getName(type)) return
    }
  }

  throw new TypeError('Expected ' + (getName(type) || type) + ', got ' + value)
}

function getName(fn) {
  // Why not fn.name: https://kangax.github.io/compat-table/es6/#function_name_property
  var match = fn.toString().match(/function (.*?)\(/)
  return match ? match[1] : null
}
