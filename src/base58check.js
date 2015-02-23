var bs58check = require('bs58check')

function decode() {
  console.warn('bs58check will be removed in 2.0.0. require("bs58check") instead.');

  return bs58check.decode.apply(undefined, arguments)
}

function encode() {
  console.warn('bs58check will be removed in 2.0.0. require("bs58check") instead.');

  return bs58check.encode.apply(undefined, arguments)
}

module.exports = {
  decode: decode,
  encode: encode
}
