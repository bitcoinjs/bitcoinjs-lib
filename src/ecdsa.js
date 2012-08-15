function integerToBytes(i, len) {
  var bytes = i.toByteArrayUnsigned();

  if (len < bytes.length) {
    bytes = bytes.slice(bytes.length-len);
  } else while (len > bytes.length) {
    bytes.unshift(0);
  }

  return bytes;
};

/**
 * Find a quadratic residue (mod p) of this number. p must be an odd prime.
 *
 * For a given number a, this function solves the congruence of the form
 *
 *   x^2 = a (mod p)
 *
 * And returns x. Note that p - x is also a root.
 *
 * 0 is returned if no square root exists for these a and p.
 *
 * The Tonelli-Shanks algorithm is used (except for some simple cases
 * in which the solution is known from an identity). This algorithm
 * runs in polynomial time (unless the generalized Riemann hypothesis
 * is false).
 *
 * Originally implemented in Python by Eli Bendersky:
 * http://eli.thegreenplace.net/2009/03/07/computing-modular-square-roots-in-python/
 *
 * Ported to JavaScript by Stefan Thomas.
 */
BigInteger.prototype.modSqrt = function (p) {
  var ONE = BigInteger.ONE,
      TWO = BigInteger.valueOf(2);

  // Simple cases
  if (this.legendre(p) != 1) {
    return BigInteger.ZERO;
  } else if (this.equals(BigInteger.ZERO)) {
    return BigInteger.ZERO;
  } else if (p.equals(TWO)) {
    return p;
  } else if (p.mod(BigInteger.valueOf(4)).equals(BigInteger.valueOf(3))) {
    return this.modPow(p.add(ONE).divide(BigInteger.valueOf(4)), p);
  }

  // Partition p-1 to s * 2^e for an odd s (i.e. reduce all the powers
  // of 2 from p-1)
  var s = p.subtract(ONE);
  var e = 0;
  while (s.isEven()) {
    s = s.divide(TWO);
    ++e;
  }

  // Find some 'n' with a legendre symbol n|p = -1.
  // Shouldn't take long.
  var n = TWO;
  while (n.legendre(p) != -1) {
    n = n.add(ONE);
  }

  // Here be dragons!
  // Read the paper "Square roots from 1; 24, 51, 10 to Dan Shanks" by
  // Ezra Brown for more information

  // x is a guess of the square root that gets better with each
  // iteration.
  //
  // b is the "fudge factor" - by how much we're off with the guess.
  // The invariant x^2 = ab (mod p) is maintained throughout the loop.
  //
  // g is used for successive powers of n to update both a and b
  //
  // r is the exponent - decreases with each update

  var x = this.modPow(s.add(ONE).divide(TWO), p);
  var b = this.modPow(s, p);
  var g = n.modPow(s, p);
  var r = e;

  for (;;) {
    var t = b;

    var m;
    for (m = 0; m < r; m++) {
      if (t.equals(ONE)) break;

      t = t.modPowInt(2, p);
    }

    if (m == 0) {
      return x;
    }

    var gs = g.modPow(TWO.pow(BigInteger.valueOf(r - m - 1)), p);
    g = gs.multiply(gs).mod(p);
    x = x.multiply(gs).mod(p);
    b = b.multiply(g).mod(p);
    r = m;
  }
};

/**
 * Compute the Legendre symbol a|p using Euler's criterion.
 *
 * p is a prime, a is relatively prime to p
 * (if p divides a, then a | p = 0)
 *
 * Returns 1 if a has a square root modulo p, -1 otherwise.
 */
BigInteger.prototype.legendre = function (p) {
  var ls = this.modPow(p.subtract(BigInteger.ONE).shiftRight(1), p);
  if (ls.equals(p.subtract(BigInteger.ONE))) {
    return -1;
  } else if (ls.equals(BigInteger.ZERO)) {
    return 0;
  } else {
    return 1;
  }
};

ECFieldElementFp.prototype.getByteLength = function () {
  return Math.floor((this.toBigInteger().bitLength() + 7) / 8);
};

ECPointFp.prototype.getEncoded = function (compressed) {
  var x = this.getX().toBigInteger();
  var y = this.getY().toBigInteger();

  // Get value as a 32-byte Buffer
  // Fixed length based on a patch by bitaddress.org and Casascius
  var enc = integerToBytes(x, 32);

  if (compressed) {
    if (y.isEven()) {
      // Compressed even pubkey
      // M = 02 || X
      enc.unshift(0x02);
    } else {
      // Compressed uneven pubkey
      // M = 03 || X
      enc.unshift(0x03);
    }
  } else {
    // Uncompressed pubkey
    // M = 04 || X || Y
    enc.unshift(0x04);
    enc = enc.concat(integerToBytes(y, 32));
  }
  return enc;
};

ECPointFp.decodeFrom = function (curve, enc) {
  var type = enc[0];
  var dataLen = enc.length-1;

  // Extract x and y as byte arrays
  var xBa = enc.slice(1, 1 + dataLen/2);
  var yBa = enc.slice(1 + dataLen/2, 1 + dataLen);

  // Prepend zero byte to prevent interpretation as negative integer
  xBa.unshift(0);
  yBa.unshift(0);

  // Convert to BigIntegers
  var x = new BigInteger(xBa);
  var y = new BigInteger(yBa);

  // Return point
  return new ECPointFp(curve, curve.fromBigInteger(x), curve.fromBigInteger(y));
};

ECPointFp.prototype.add2D = function (b) {
  if(this.isInfinity()) return b;
  if(b.isInfinity()) return this;

  if (this.x.equals(b.x)) {
    if (this.y.equals(b.y)) {
      // this = b, i.e. this must be doubled
      return this.twice();
    }
    // this = -b, i.e. the result is the point at infinity
    return this.curve.getInfinity();
  }

  var x_x = b.x.subtract(this.x);
  var y_y = b.y.subtract(this.y);
  var gamma = y_y.divide(x_x);

  var x3 = gamma.square().subtract(this.x).subtract(b.x);
  var y3 = gamma.multiply(this.x.subtract(x3)).subtract(this.y);

  return new ECPointFp(this.curve, x3, y3);
};

ECPointFp.prototype.twice2D = function () {
  if (this.isInfinity()) return this;
  if (this.y.toBigInteger().signum() == 0) {
    // if y1 == 0, then (x1, y1) == (x1, -y1)
    // and hence this = -this and thus 2(x1, y1) == infinity
    return this.curve.getInfinity();
  }

  var TWO = this.curve.fromBigInteger(BigInteger.valueOf(2));
  var THREE = this.curve.fromBigInteger(BigInteger.valueOf(3));
  var gamma = this.x.square().multiply(THREE).add(this.curve.a).divide(this.y.multiply(TWO));

  var x3 = gamma.square().subtract(this.x.multiply(TWO));
  var y3 = gamma.multiply(this.x.subtract(x3)).subtract(this.y);

  return new ECPointFp(this.curve, x3, y3);
};

ECPointFp.prototype.multiply2D = function (k) {
  if(this.isInfinity()) return this;
  if(k.signum() == 0) return this.curve.getInfinity();

  var e = k;
  var h = e.multiply(new BigInteger("3"));

  var neg = this.negate();
  var R = this;

  var i;
  for (i = h.bitLength() - 2; i > 0; --i) {
    R = R.twice();

    var hBit = h.testBit(i);
    var eBit = e.testBit(i);

    if (hBit != eBit) {
      R = R.add2D(hBit ? this : neg);
    }
  }

  return R;
};

ECPointFp.prototype.isOnCurve = function () {
  var x = this.getX().toBigInteger();
  var y = this.getY().toBigInteger();
  var a = this.curve.getA().toBigInteger();
  var b = this.curve.getB().toBigInteger();
  var n = this.curve.getQ();
  var lhs = y.multiply(y).mod(n);
  var rhs = x.multiply(x).multiply(x)
    .add(a.multiply(x)).add(b).mod(n);
  return lhs.equals(rhs);
};

ECPointFp.prototype.toString = function () {
  return '('+this.getX().toBigInteger().toString()+','+
    this.getY().toBigInteger().toString()+')';
};

/**
 * Validate an elliptic curve point.
 *
 * See SEC 1, section 3.2.2.1: Elliptic Curve Public Key Validation Primitive
 */
ECPointFp.prototype.validate = function () {
  var n = this.curve.getQ();

  // Check Q != O
  if (this.isInfinity()) {
    throw new Error("Point is at infinity.");
  }

  // Check coordinate bounds
  var x = this.getX().toBigInteger();
  var y = this.getY().toBigInteger();
  if (x.compareTo(BigInteger.ONE) < 0 ||
      x.compareTo(n.subtract(BigInteger.ONE)) > 0) {
    throw new Error('x coordinate out of bounds');
  }
  if (y.compareTo(BigInteger.ONE) < 0 ||
      y.compareTo(n.subtract(BigInteger.ONE)) > 0) {
    throw new Error('y coordinate out of bounds');
  }

  // Check y^2 = x^3 + ax + b (mod n)
  if (!this.isOnCurve()) {
    throw new Error("Point is not on the curve.");
  }

  // Check nQ = 0 (Q is a scalar multiple of G)
  if (this.multiply(n).isInfinity()) {
    // TODO: This check doesn't work - fix.
    throw new Error("Point is not a scalar multiple of G.");
  }

  return true;
};

function dmp(v) {
  if (!(v instanceof BigInteger)) v = v.toBigInteger();
  return Crypto.util.bytesToHex(v.toByteArrayUnsigned());
};

Bitcoin.ECDSA = (function () {
  var ecparams = getSECCurveByName("secp256k1");
  var rng = new SecureRandom();

  function implShamirsTrick(P, k, Q, l)
  {
    var m = Math.max(k.bitLength(), l.bitLength());
    var Z = P.add2D(Q);
    var R = P.curve.getInfinity();

    for (var i = m - 1; i >= 0; --i) {
      R = R.twice2D();

      R.z = BigInteger.ONE;

      if (k.testBit(i)) {
        if (l.testBit(i)) {
          R = R.add2D(Z);
        } else {
          R = R.add2D(P);
        }
      } else {
        if (l.testBit(i)) {
          R = R.add2D(Q);
        }
      }
    }

    return R;
  };

  var ECDSA = {
    getBigRandom: function (limit) {
      return new BigInteger(limit.bitLength(), rng)
        .mod(limit.subtract(BigInteger.ONE))
        .add(BigInteger.ONE)
      ;
    },
    sign: function (hash, priv) {
      var d = priv;
      var n = ecparams.getN();
      var e = BigInteger.fromByteArrayUnsigned(hash);

      do {
        var k = ECDSA.getBigRandom(n);
        var G = ecparams.getG();
        var Q = G.multiply(k);
        var r = Q.getX().toBigInteger().mod(n);
      } while (r.compareTo(BigInteger.ZERO) <= 0);

      var s = k.modInverse(n).multiply(e.add(d.multiply(r))).mod(n);

      return ECDSA.serializeSig(r, s);
    },

    verify: function (hash, sig, pubkey) {
      var r,s;
      if (Bitcoin.Util.isArray(sig)) {
        var obj = stringECDSA.parseSig(sig);
        r = obj.r;
        s = obj.s;
      } else if ("object" === typeof sig && sig.r && sig.s) {
        r = sig.r;
        s = sig.s;
      } else {
        throw "Invalid value for signature";
      }

      var Q;
      if (pubkey instanceof ECPointFp) {
        Q = pubkey;
      } else if (Bitcoin.Util.isArray(pubkey)) {
        Q = ECPointFp.decodeFrom(ecparams.getCurve(), pubkey);
      } else {
        throw "Invalid format for pubkey value, must be byte array or ECPointFp";
      }
      var e = BigInteger.fromByteArrayUnsigned(hash);

      return ECDSA.verifyRaw(e, r, s, Q);
    },

    verifyRaw: function (e, r, s, Q) {
      var n = ecparams.getN();
      var G = ecparams.getG();

      if (r.compareTo(BigInteger.ONE) < 0 ||
          r.compareTo(n) >= 0)
        return false;

      if (s.compareTo(BigInteger.ONE) < 0 ||
          s.compareTo(n) >= 0)
        return false;

      var c = s.modInverse(n);

      var u1 = e.multiply(c).mod(n);
      var u2 = r.multiply(c).mod(n);

      // TODO(!!!): For some reason Shamir's trick isn't working with
      // signed message verification!? Probably an implementation
      // error!
      //var point = implShamirsTrick(G, u1, Q, u2);
      var point = G.multiply(u1).add(Q.multiply(u2));

      var v = point.getX().toBigInteger().mod(n);

      return v.equals(r);
    },

    /**
     * Serialize a signature into DER format.
     *
     * Takes two BigIntegers representing r and s and returns a byte array.
     */
    serializeSig: function (r, s) {
      var rBa = r.toByteArrayUnsigned();
      var sBa = s.toByteArrayUnsigned();

      var sequence = [];
      sequence.push(0x02); // INTEGER
      sequence.push(rBa.length);
      sequence = sequence.concat(rBa);

      sequence.push(0x02); // INTEGER
      sequence.push(sBa.length);
      sequence = sequence.concat(sBa);

      sequence.unshift(sequence.length);
      sequence.unshift(0x30); // SEQUENCE

      return sequence;
    },

    /**
     * Parses a byte array containing a DER-encoded signature.
     *
     * This function will return an object of the form:
     * 
     * {
     *   r: BigInteger,
     *   s: BigInteger
     * }
     */
    parseSig: function (sig) {
      var cursor;
      if (sig[0] != 0x30)
        throw new Error("Signature not a valid DERSequence");

      cursor = 2;
      if (sig[cursor] != 0x02)
        throw new Error("First element in signature must be a DERInteger");;
      var rBa = sig.slice(cursor+2, cursor+2+sig[cursor+1]);

      cursor += 2+sig[cursor+1];
      if (sig[cursor] != 0x02)
        throw new Error("Second element in signature must be a DERInteger");
      var sBa = sig.slice(cursor+2, cursor+2+sig[cursor+1]);

      cursor += 2+sig[cursor+1];

      //if (cursor != sig.length)
      //  throw new Error("Extra bytes in signature");

      var r = BigInteger.fromByteArrayUnsigned(rBa);
      var s = BigInteger.fromByteArrayUnsigned(sBa);

      return {r: r, s: s};
    },

    parseSigCompact: function (sig) {
      if (sig.length !== 65) {
        throw "Signature has the wrong length";
      }

      // Signature is prefixed with a type byte storing three bits of
      // information.
      var i = sig[0] - 27;
      if (i < 0 || i > 7) {
        throw "Invalid signature type";
      }

      var n = ecparams.getN();
      var r = BigInteger.fromByteArrayUnsigned(sig.slice(1, 33)).mod(n);
      var s = BigInteger.fromByteArrayUnsigned(sig.slice(33, 65)).mod(n);

      return {r: r, s: s, i: i};
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
      // The recovery parameter i has two bits.
      i = i & 3;

      // The less significant bit specifies whether the y coordinate
      // of the compressed point is even or not.
      var isYEven = i & 1;

      // The more significant bit specifies whether we should use the
      // first or second candidate key.
      var isSecondKey = i >> 1;

      var n = ecparams.getN();
      var G = ecparams.getG();
      var curve = ecparams.getCurve();
      var p = curve.getQ();
      var a = curve.getA().toBigInteger();
      var b = curve.getB().toBigInteger();

      // 1.1 Compute x
      var x = isSecondKey ? r.add(n) : r;

      // 1.3 Convert x to point
      var alpha = x.multiply(x).multiply(x).add(a.multiply(x)).add(b).mod(p);
      var beta = alpha.modSqrt(p);

      var xorOdd = beta.isEven() ? (i % 2) : ((i+1) % 2);
      // If beta is even, but y isn't or vice versa, then convert it,
      // otherwise we're done and y == beta.
      var y = (beta.isEven() ? !isYEven : isYEven) ? beta : p.subtract(beta);

      // 1.4 Check that nR is at infinity
      var R = new ECPointFp(curve,
                            curve.fromBigInteger(x),
                            curve.fromBigInteger(y));
      R.validate();

      // 1.5 Compute e from M
      var e = BigInteger.fromByteArrayUnsigned(hash);
      var eNeg = BigInteger.ZERO.subtract(e).mod(n);

      // 1.6 Compute Q = r^-1 (sR - eG)
      var rInv = r.modInverse(n);
      var Q = implShamirsTrick(R, s, G, eNeg).multiply(rInv);

      Q.validate();
      if (!ECDSA.verifyRaw(e, r, s, Q)) {
        throw "Pubkey recovery unsuccessful";
      }

      var pubKey = new Bitcoin.ECKey();
      pubKey.pub = Q;
      return pubKey;
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
    calcPubkeyRecoveryParam: function (r, s, hash)
    {
      for (var i = 0; i < 4; i++) {
        try {
          if (Bitcoin.ECDSA.recoverPubKey(r, s, hash, i)) {
            return i;
          }
        } catch (e) {}
      }
      throw "Unable to find valid recovery factor";
    }
  };

  return ECDSA;
})();
