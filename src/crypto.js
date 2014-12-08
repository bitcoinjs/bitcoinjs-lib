var crypto = require('crypto')

function hash160(buffer) {
  return ripemd160(sha256(buffer))
}

function hash256(buffer) {
  return sha256(sha256(buffer))
}

function ripemd160(buffer) {
  return crypto.createHash('rmd160').update(buffer).digest()
}

function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest()
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest()
}

// FIXME: Name not consistent with others
function HmacSHA256(buffer, secret) {
  console.warn('Hmac* functions are deprecated for removal in 2.0.0, use node crypto instead')
  return crypto.createHmac('sha256', secret).update(buffer).digest()
}

function HmacSHA512(buffer, secret) {
  console.warn('Hmac* functions are deprecated for removal in 2.0.0, use node crypto instead')
  return crypto.createHmac('sha512', secret).update(buffer).digest()
}

module.exports = {
  ripemd160: ripemd160,
  sha1: sha1,
  sha256: sha256,
  hash160: hash160,
  hash256: hash256,
  HmacSHA256: HmacSHA256,
  HmacSHA512: HmacSHA512
}
