// {signature} {pubKey}

var pkh = require('../pubkeyhash/input')

module.exports = {
  check: pkh.check,
  decodeStack: pkh.decodeStack,
  encodeStack: pkh.encodeStack
}
