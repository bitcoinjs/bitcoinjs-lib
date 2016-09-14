var BN = require('bn.js')
var bip66 = require('bip66')

function decodeDER (buffer) {
  var decode = bip66.decode(buffer)
  var r = new BN(decode.r)
  var s = new BN(decode.s)

  return { r: r, s: s }
}

function encodeDER (signature) {
  // TODO: add type checking?
  if (!BN.isBN(signature.r)) throw new TypeError('Expected BN R value')
  if (!BN.isBN(signature.s)) throw new TypeError('Expected BN S value')

  var r = signature.r.toArray(undefined, 32)
  var s = signature.s.toArray(undefined, 32)

  if (r[0] & 0x80) r = [0].concat(r)
  if (s[0] & 0x80) s = [0].concat(s)

  r = new Buffer(r)
  s = new Buffer(s)

  return bip66.encode(r, s)
}

// BIP62: 1 byte hashType flag (only 0x01, 0x02, 0x03, 0x81, 0x82 and 0x83 are allowed)
function decode (buffer) {
  var signature = decodeDER(buffer.slice(0, -1))
  var hashType = buffer.readUInt8(buffer.length - 1)
  var hashTypeMod = hashType & ~0x80

  if (hashTypeMod <= 0x00 || hashTypeMod >= 0x04) throw new TypeError('Invalid hashType ' + hashType)

  return {
    signature: signature,
    hashType: hashType
  }
}

function encode (signature, hashType) {
  var hashTypeMod = hashType & ~0x80
  if (hashTypeMod <= 0 || hashTypeMod >= 4) throw new TypeError('Invalid hashType ' + hashType)

  var hashTypeBuffer = new Buffer(1)
  hashTypeBuffer.writeUInt8(hashType, 0)

  return Buffer.concat([encodeDER(signature), hashTypeBuffer])
}

module.exports = {
  decode,
  encode
}
