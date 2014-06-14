var assert = require('assert')
var crypto = require('./crypto')

var BigInteger = require('bigi')
var Point = require('ecurve').Point

function deterministicGenerateK(curve, hash, d) {
  assert(Buffer.isBuffer(hash), 'Hash must be a Buffer, not ' + hash)
  assert.equal(hash.length, 32, 'Hash must be 256 bit')
  assert(d instanceof BigInteger, 'Private key must be a BigInteger')

  var x = d.toBuffer(32)
  var k = new Buffer(32)
  var v = new Buffer(32)
  k.fill(0)
  v.fill(1)

  k = crypto.HmacSHA256(Buffer.concat([v, new Buffer([0]), x, hash]), k)
  v = crypto.HmacSHA256(v, k)

  k = crypto.HmacSHA256(Buffer.concat([v, new Buffer([1]), x, hash]), k)
  v = crypto.HmacSHA256(v, k)
  v = crypto.HmacSHA256(v, k)

  var n = curve.params.n
  var kB = BigInteger.fromBuffer(v).mod(n)
  assert(kB.compareTo(BigInteger.ONE) > 0, 'Invalid k value')
  assert(kB.compareTo(n) < 0, 'Invalid k value')

  return kB
}

function sign(curve, hash, d) {
  var k = deterministicGenerateK(curve, hash, d)

  var n = curve.params.n
  var G = curve.params.G
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

  return {r: r, s: s}
}

function verify(curve, hash, signature, Q) {
  var e = BigInteger.fromBuffer(hash)

  return verifyRaw(curve, e, signature, Q)
}

function verifyRaw(curve, e, signature, Q) {
  var n = curve.params.n
  var G = curve.params.G

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
  * Serialize a signature into DER format.
  *
  * Takes two BigIntegers representing r and s and returns a byte array.
  */
function serializeSig(signature) {
  var rBa = signature.r.toDERInteger()
  var sBa = signature.s.toDERInteger()

  var sequence = []
  sequence.push(0x02) // INTEGER
  sequence.push(rBa.length)
  sequence = sequence.concat(rBa)

  sequence.push(0x02) // INTEGER
  sequence.push(sBa.length)
  sequence = sequence.concat(sBa)

  sequence.unshift(sequence.length)
  sequence.unshift(0x30) // SEQUENCE

  return new Buffer(sequence)
}

/**
  * Parses a buffer containing a DER-encoded signature.
  *
  * This function will return an object of the form:
  *
  * {
  *   r: BigInteger,
  *   s: BigInteger
  * }
  */
function parseSig(buffer) {
  assert.equal(buffer.readUInt8(0), 0x30, 'Not a DER sequence')
  assert.equal(buffer.readUInt8(1), buffer.length - 2, 'Invalid sequence length')

  assert.equal(buffer.readUInt8(2), 0x02, 'Expected a DER integer')
  var rLen = buffer.readUInt8(3)
  var rB = buffer.slice(4, 4 + rLen)

  var offset = 4 + rLen
  assert.equal(buffer.readUInt8(offset), 0x02, 'Expected a DER integer (2)')
  var sLen = buffer.readUInt8(1 + offset)
  var sB = buffer.slice(2 + offset)
  offset += 2 + sLen

  assert.equal(offset, buffer.length, 'Invalid DER encoding')

  return {
    r: BigInteger.fromDERInteger(rB),
    s: BigInteger.fromDERInteger(sB)
  }
}

function serializeSigCompact(signature, i, compressed) {
  if (compressed) {
    i += 4
  }

  i += 27

  var buffer = new Buffer(65)
  buffer.writeUInt8(i, 0)

  signature.r.toBuffer(32).copy(buffer, 1)
  signature.s.toBuffer(32).copy(buffer, 33)

  return buffer
}

function parseSigCompact(buffer) {
  assert.equal(buffer.length, 65, 'Invalid signature length')
  var i = buffer.readUInt8(0) - 27

  // At most 3 bits
  assert.equal(i, i & 7, 'Invalid signature parameter')
  var compressed = !!(i & 4)

  // Recovery param only
  i = i & 3

  var r = BigInteger.fromBuffer(buffer.slice(1, 33))
  var s = BigInteger.fromBuffer(buffer.slice(33))

  return {
    signature: {
      r: r,
      s: s
    },
    i: i,
    compressed: compressed
  }
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
  // By reduction, the y-coordinate is even if it is clear
  var isYEven = !(i & 1)

  // The more significant bit specifies whether we should use the
  // first or second candidate key.
  var isSecondKey = i >> 1

  var n = curve.params.n
  var G = curve.params.G
  var p = curve.p
  var a = curve.a
  var b = curve.b

  // We precalculate (p + 1) / 4 where p is the field order
  if (!curve.P_OVER_FOUR) {
    curve.P_OVER_FOUR = p.add(BigInteger.ONE).shiftRight(2)
  }

  // 1.1 Let x = r + jn
  var x = isSecondKey ? r.add(n) : r

  // 1.2, 1.3 Convert x to a point R using routine specified in Section 2.3.4
  var alpha = x.pow(3).add(a.multiply(x)).add(b).mod(p)
  var beta = alpha.modPow(curve.P_OVER_FOUR, p)

  // If beta is even, but y isn't, or vice versa, then convert it,
  // otherwise we're done and y == beta.
  var y = (beta.isEven() ^ isYEven) ? p.subtract(beta) : beta

  // 1.4 Check that nR is at infinity
  var R = Point.fromAffine(curve, x, y)
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
  verifyRaw: verifyRaw,
  serializeSig: serializeSig,
  parseSig: parseSig,
  serializeSigCompact: serializeSigCompact,
  parseSigCompact: parseSigCompact
}
