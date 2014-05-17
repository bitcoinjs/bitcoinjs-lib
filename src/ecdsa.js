var assert = require('assert')
var crypto = require('./crypto')
var sec = require('./sec')
var ecparams = sec("secp256k1")

var BigInteger = require('bigi')
var ECPointFp = require('./ec').ECPointFp

function implShamirsTrick(P, k, Q, l) {
  var m = Math.max(k.bitLength(), l.bitLength())
  var Z = P.add2D(Q)
  var R = P.curve.getInfinity()

  for (var i = m - 1; i >= 0; --i) {
    R = R.twice2D()

    R.z = BigInteger.ONE

    if (k.testBit(i)) {
      if (l.testBit(i)) {
        R = R.add2D(Z)
      } else {
        R = R.add2D(P)
      }
    } else {
      if (l.testBit(i)) {
        R = R.add2D(Q)
      }
    }
  }

  return R
}

var ecdsa = {
  deterministicGenerateK: function(hash, D) {
    assert(Buffer.isBuffer(hash), 'Hash must be a Buffer')
    assert.equal(hash.length, 32, 'Hash must be 256 bit')
    assert(D instanceof BigInteger, 'Private key must be a BigInteger')

    var x = D.toBuffer(32)
    var k = new Buffer(32)
    var v = new Buffer(32)
    k.fill(0)
    v.fill(1)

    k = crypto.HmacSHA256(Buffer.concat([v, new Buffer([0]), x, hash]), k)
    v = crypto.HmacSHA256(v, k)

    k = crypto.HmacSHA256(Buffer.concat([v, new Buffer([1]), x, hash]), k)
    v = crypto.HmacSHA256(v, k)
    v = crypto.HmacSHA256(v, k)

    var n = ecparams.getN()
    var kB = BigInteger.fromBuffer(v).mod(n)
    assert(kB.compareTo(BigInteger.ONE) > 0, 'Invalid k value')
    assert(kB.compareTo(ecparams.getN()) < 0, 'Invalid k value')

    return kB
  },

  sign: function (hash, D) {
    var k = ecdsa.deterministicGenerateK(hash, D)

    var n = ecparams.getN()
    var G = ecparams.getG()
    var Q = G.multiply(k)
    var e = BigInteger.fromBuffer(hash)

    var r = Q.getX().toBigInteger().mod(n)
    assert.notEqual(r.signum(), 0, 'Invalid R value')

    var s = k.modInverse(n).multiply(e.add(D.multiply(r))).mod(n)
    assert.notEqual(s.signum(), 0, 'Invalid S value')

    var N_OVER_TWO = n.divide(BigInteger.valueOf(2))

    // Make 's' value 'low' as per bip62
    if (s.compareTo(N_OVER_TWO) > 0) {
      s = n.subtract(s)
    }

    return ecdsa.serializeSig(r, s)
  },

  verify: function (hash, sig, pubkey) {
    var r,s
    if (Array.isArray(sig) || Buffer.isBuffer(sig)) {
      var obj = ecdsa.parseSig(sig)
      r = obj.r
      s = obj.s
    } else if ("object" === typeof sig && sig.r && sig.s) {
      r = sig.r
      s = sig.s
    } else {
      throw new Error("Invalid value for signature")
    }

    var Q
    if (pubkey instanceof ECPointFp) {
      Q = pubkey
    } else if (Array.isArray(pubkey) || Buffer.isBuffer(pubkey)) {
      Q = ECPointFp.decodeFrom(ecparams.getCurve(), pubkey)
    } else {
      throw new Error("Invalid format for pubkey value, must be byte array or ECPointFp")
    }
    var e = BigInteger.fromBuffer(hash)

    return ecdsa.verifyRaw(e, r, s, Q)
  },

  verifyRaw: function (e, r, s, Q) {
    var n = ecparams.getN()
    var G = ecparams.getG()

    if (r.compareTo(BigInteger.ONE) < 0 || r.compareTo(n) >= 0) {
      return false
    }

    if (s.compareTo(BigInteger.ONE) < 0 || s.compareTo(n) >= 0) {
      return false
    }

    var c = s.modInverse(n)

    var u1 = e.multiply(c).mod(n)
    var u2 = r.multiply(c).mod(n)

    // TODO(!!!): For some reason Shamir's trick isn't working with
    // signed message verification!? Probably an implementation
    // error!
    //var point = implShamirsTrick(G, u1, Q, u2)
    var point = G.multiply(u1).add(Q.multiply(u2))

    var v = point.getX().toBigInteger().mod(n)

    return v.equals(r)
  },

  /**
   * Serialize a signature into DER format.
   *
   * Takes two BigIntegers representing r and s and returns a byte array.
   */
  serializeSig: function (r, s) {
    var rBa = r.toByteArraySigned()
    var sBa = s.toByteArraySigned()

    var sequence = []
    sequence.push(0x02); // INTEGER
    sequence.push(rBa.length)
    sequence = sequence.concat(rBa)

    sequence.push(0x02); // INTEGER
    sequence.push(sBa.length)
    sequence = sequence.concat(sBa)

    sequence.unshift(sequence.length)
    sequence.unshift(0x30); // SEQUENCE

    return sequence
  },

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
  parseSig: function (buffer) {
    if (Array.isArray(buffer)) buffer = new Buffer(buffer) // FIXME: transitionary

    assert.equal(buffer.readUInt8(0), 0x30, 'Not a DER sequence')
    assert.equal(buffer.readUInt8(1), buffer.length - 2, 'Invalid sequence length')

    assert.equal(buffer.readUInt8(2), 0x02, 'Expected DER integer')
    var rLen = buffer.readUInt8(3)
    var rB = buffer.slice(4, 4 + rLen)

    var offset = 4 + rLen
    assert.equal(buffer.readUInt8(offset), 0x02, 'Expected a 2nd DER integer')
    var sLen = buffer.readUInt8(1 + offset)
    var sB = buffer.slice(2 + offset)

    return {
      r: BigInteger.fromByteArraySigned(rB),
      s: BigInteger.fromByteArraySigned(sB)
    }
  },

  serializeSigCompact: function(r, s, i, compressed) {
    if (compressed) {
      i += 4
    }

    i += 27

    var buffer = new Buffer(65)
    buffer.writeUInt8(i, 0)
    r.toBuffer(32).copy(buffer, 1)
    s.toBuffer(32).copy(buffer, 33)

    return buffer
  },

  parseSigCompact: function (buffer) {
    assert.equal(buffer.length, 65, 'Invalid signature length')
    var i = buffer.readUInt8(0) - 27

    // At most 3 bits
    assert.equal(i, i & 7, 'Invalid signature type')
    var compressed = !!(i & 4)

    // Recovery param only
    i = i & 3

    var r = BigInteger.fromBuffer(buffer.slice(1, 33))
    var s = BigInteger.fromBuffer(buffer.slice(33))

    return {
      r: r,
      s: s,
      i: i,
      compressed: compressed
    }
  },

  /**
   * Recover a public key from a signature.
   *
   * See SEC 1: Elliptic Curve Cryptography, section 4.1.6, "Public
   * Key Recovery Operation".
   *
   * http://www.secg.org/download/aid-780/sec1-v2.pdf
   */
  recoverPubKey: function (r, s, hash, i) {
    assert.strictEqual(i & 3, i, 'The recovery param is more than two bits')

    // A set LSB signifies that the y-coordinate is odd
    // By reduction, the y-coordinate is even if it is clear
    var isYEven = !(i & 1)

    // The more significant bit specifies whether we should use the
    // first or second candidate key.
    var isSecondKey = i >> 1

    var n = ecparams.getN()
    var G = ecparams.getG()
    var curve = ecparams.getCurve()
    var p = curve.getQ()
    var a = curve.getA().toBigInteger()
    var b = curve.getB().toBigInteger()

    // We precalculate (p + 1) / 4 where p is the field order
    if (!curve.P_OVER_FOUR) {
      curve.P_OVER_FOUR = p.add(BigInteger.ONE).shiftRight(2)
    }

    // 1.1 Compute x
    var x = isSecondKey ? r.add(n) : r

    // 1.3 Convert x to point
    var alpha = x.multiply(x).multiply(x).add(a.multiply(x)).add(b).mod(p)
    var beta = alpha.modPow(curve.P_OVER_FOUR, p)

    // If beta is even, but y isn't, or vice versa, then convert it,
    // otherwise we're done and y == beta.
    var y = (beta.isEven() ^ isYEven) ? p.subtract(beta) : beta

    // 1.4 Check that nR is at infinity
    var R = new ECPointFp(curve, curve.fromBigInteger(x), curve.fromBigInteger(y))
    R.validate()

    // 1.5 Compute e from M
    var e = BigInteger.fromBuffer(hash)
    var eNeg = BigInteger.ZERO.subtract(e).mod(n)

    // 1.6 Compute Q = r^-1 (sR - eG)
    var rInv = r.modInverse(n)
    var Q = implShamirsTrick(R, s, G, eNeg).multiply(rInv)

    Q.validate()
    if (!ecdsa.verifyRaw(e, r, s, Q)) {
      throw new Error("Pubkey recovery unsuccessful")
    }

    return Q
  },

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
  calcPubKeyRecoveryParam: function (origPubKey, r, s, hash) {
    for (var i = 0; i < 4; i++) {
      var pubKey = ecdsa.recoverPubKey(r, s, hash, i)

      if (pubKey.equals(origPubKey)) {
        return i
      }
    }

    throw new Error("Unable to find valid recovery factor")
  }
}

module.exports = ecdsa
