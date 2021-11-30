const lazy = require('./lazy')
const typef = require('typeforce')
const OPS = require('bitcoin-ops')

const bscript = require('../script')
const BITCOIN_NETWORK = require('../networks').bitcoin

function stacksEqual (a, b) {
  if (a.length !== b.length) return false

  return a.every(function (x, i) {
    return x.equals(b[i])
  })
}

// output: OP_RETURN ...
function p2data (a, opts) {
  if (
    !a.data &&
    !a.output
  ) throw new TypeError('Not enough data')
  opts = Object.assign({ validate: true }, opts || {})

  typef({
    network: typef.maybe(typef.Object),
    output: typef.maybe(typef.Buffer),
    data: typef.maybe(typef.arrayOf(typef.Buffer))
  }, a)

  const network = a.network || BITCOIN_NETWORK
  const o = { network }

  lazy.prop(o, 'output', function () {
    if (!a.data) return
    return bscript.compile([OPS.OP_RETURN].concat(a.data))
  })
  lazy.prop(o, 'data', function () {
    if (!a.output) return
    return bscript.decompile(a.output).slice(1)
  })

  // extended validation
  if (opts.validate) {
    if (a.output) {
      const chunks = bscript.decompile(a.output)
      if (chunks[0] !== OPS.OP_RETURN) throw new TypeError('Output is invalid')
      if (!chunks.slice(1).every(typef.Buffer)) throw new TypeError('Output is invalid')

      if (a.data && !stacksEqual(a.data, o.data)) throw new TypeError('Data mismatch')
    }
  }

  return Object.assign(o, a)
}

module.exports = p2data
