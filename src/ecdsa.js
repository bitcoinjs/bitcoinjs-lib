var assert = require('assert')
var crypto = require('./crypto')

var BigInteger = require('bigi')
var ECSignature = require('./ecsignature')
var Point = require('ecurve').Point

// https://tools.ietf.org/html/rfc6979#section-3.2
function deterministicGenerateK(curve, hash, d) {
  assert(Buffer.isBuffer(hash), 'Hash must be a Buffer, not ' + hash)
  assert.equal(hash.length, 32, 'Hash must be 256 bit')
  assert(d instanceof BigInteger, 'Private key must be a BigInteger')

  var x = d.toBuffer(32)
  var k = new Buffer(32)
  var v = new Buffer(32)

  // Step B
  v.fill(1)

  // Step C
  k.fill(0)

  // Step D
  k = crypto.HmacSHA256(Buffer.concat([v, new Buffer([0]), x, hash]), k)

  // Step E
  v = crypto.HmacSHA256(v, k)

  // Step F
  k = crypto.HmacSHA256(Buffer.concat([v, new Buffer([1]), x, hash]), k)

  // Step G
  v = crypto.HmacSHA256(v, k)

  // Step H1/H2a, ignored as tlen === qlen (256 bit)
  // Step H2b
  v = crypto.HmacSHA256(v, k)

  var T = BigInteger.fromBuffer(v)

  // Step H3, repeat until T is within the interval [1, n - 1]
  while ((T.signum() <= 0) || (T.compareTo(curve.n) >= 0)) {
    k = crypto.HmacSHA256(Buffer.concat([v, new Buffer([0])]), k)
    v = crypto.HmacSHA256(v, k)

    T = BigInteger.fromBuffer(v)
  }

  return T
}

function sign(curve, hash, d) {
  var k = deterministicGenerateK(curve, hash, d)

  var n = curve.n
  var G = curve.G
  var Q = G.multiply(k)
  var e = BigInteger.fromBuffer(hash)

  var r = Q.affineX.mod(n)
  assert.notEqual(r.signum(), 0, 'Invalid R value')

  var s = k.modInverse(n).multiply(e.add(d.multiply(r))).mod(n)
  assert.notEqual(s.signum(), 0, 'Invalid S value')

  var N_OVER_TWO = n.shiftRight(1)

  // enforce low S values, see bip62: 'low s values in signatures'
  if (s.compareTo(N_OVER_TWO) > 0) {
    s = n.subtract(s)
  }

  return new ECSignature(r, s)
}

function verify(curve, hash, signature, Q) {
  var e = BigInteger.fromBuffer(hash)

  return verifyRaw(curve, e, signature, Q)
}

function verifyRaw(curve, e, signature, Q) {
  var n = curve.n
  var G = curve.G

  var r = signature.r
  var s = signature.s

  if (r.signum() === 0 || r.compareTo(n) >= 0) return false
  if (s.signum() === 0 || s.compareTo(n) >= 0) return false

  var c = s.modInverse(n)

  var u1 = e.multiply(c).mod(n)
  var u2 = r.multiply(c).mod(n)

  var point = G.multiplyTwo(u1, Q, u2)
  var v = point.affineX.mod(n)

  return v.equals(r)
}

/**
  * Recover a public key from a signature.
  *
  * See SEC 1: Elliptic Curve Cryptography, section 4.1.6, "Public
  * Key Recovery Operation".
  *
  * http://www.secg.org/download/aid-780/sec1-v2.pdf
  */
function recoverPubKey(curve, e, signature, i) {
  assert.strictEqual(i & 3, i, 'Recovery param is more than two bits')

  var r = signature.r
  var s = signature.s

  // A set LSB signifies that the y-coordinate is odd
  var isYOdd = i & 1

  // The more significant bit specifies whether we should use the
  // first or second candidate key.
  var isSecondKey = i >> 1

  var n = curve.n
  var G = curve.G

  // 1.1 Let x = r + jn
  var x = isSecondKey ? r.add(n) : r
  var R = curve.pointFromX(isYOdd, x)

  // 1.4 Check that nR is at infinity
  var nR = R.multiply(n)
  assert(curve.isInfinity(nR), 'nR is not a valid curve point')

  // Compute -e from e
  var eNeg = e.negate().mod(n)

  // 1.6.1 Compute Q = r^-1 (sR -  eG)
  //               Q = r^-1 (sR + -eG)
  var rInv = r.modInverse(n)

  var Q = R.multiplyTwo(s, G, eNeg).multiply(rInv)
  curve.validate(Q)

  return Q
}

/**
  * Calculate pubkey extraction parameter.
  *
  * When extracting a pubkey from a signature, we have to
  * distinguish four different cases. Rather than putting this
  * burden on the verifier, Bitcoin includes a 2-bit value with the
  * signature.
  *
  * This function simply tries all four cases and returns the value
  * that resulted in a successful pubkey recovery.
  */
function calcPubKeyRecoveryParam(curve, e, signature, Q) {
  for (var i = 0; i < 4; i++) {
    var Qprime = recoverPubKey(curve, e, signature, i)

    // 1.6.2 Verify Q
    if (Qprime.equals(Q)) {
      return i
    }
  }

  throw new Error('Unable to find valid recovery factor')
}

module.exports = {
  calcPubKeyRecoveryParam: calcPubKeyRecoveryParam,
  deterministicGenerateK: deterministicGenerateK,
  recoverPubKey: recoverPubKey,
  sign: sign,
  verify: verify,
  verifyRaw: verifyRaw
}
