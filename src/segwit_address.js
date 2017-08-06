var bech32 = require('bech32')

function decode (expectedPrefix, string) {
  var result = bech32.decode(string)
  if (result.prefix !== expectedPrefix) {
    throw new Error('Unexpected prefix')
  }

  if (!(result.bitData.length > 0) && (result.bitData.length < 66)) {
    throw new Error('Invalid length of encoded data')
  }

  var version = result.bitData[0]
  if (version > 16) {
    throw new Error('Invalid witness version')
  }

  var program = bech32.convertBits(result.bitData.slice(1), 5, 8, false)
  if (program.length < 2 || program.length > 40) {
    throw new Error('Invalid length of witness program')
  }

  // witness version 0 length checks
  if (version === 0) {
    if (!((program.length === 20) || (program.length === 32))) {
      throw new Error('Invalid length of V0 witness program')
    }
  }

  return { version: version, program: Buffer.from(program) }
}

function encode (prefix, version, program) {
  // witness version 0 length checks
  if (version === 0) {
    if (!((program.length === 20) || (program.length === 32))) {
      throw new Error('Invalid length of V0 witness program')
    }
  }

  var bitData = bech32.convertBits(program, 8, 5, true)
  bitData.unshift(version)

  return bech32.encode(prefix, bitData)
}

module.exports = {
  encode: encode,
  decode: decode
}
