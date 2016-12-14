// {signature} {pubKey}

var p2sh = require('../scripthash/input')

module.exports = {
  check: p2sh.check,
  decodeStack: p2sh.decodeStack,
  encodeStack: p2sh.encodeStack
}
