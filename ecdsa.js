function integerToBytes(i, len) {
	var bytes = i.toByteArrayUnsigned();

	if (len < bytes.length) {
		bytes = bytes.slice(bytes.length-len);
	} else while (len > bytes.length) {
		bytes.unshift(0);
	}

	return bytes;
};

ECFieldElementFp.prototype.getByteLength = function () {
	return Math.floor((this.toBigInteger().bitLength() + 7) / 8);
};

ECPointFp.prototype.getEncoded = function (compressed) {
	var x = this.getX().toBigInteger();
	var y = this.getY().toBigInteger();

	if (compressed) {
		var PC;
	}

	var len = this.getX().getByteLength();

	var enc = integerToBytes(x, len);

	if (compressed) {
		if (y.testBit(0)) {
			enc.unshift(0x02);
		} else {
			enc.unshift(0x03);
		}
	} else {
		enc.unshift(0x04);
		enc = enc.concat(integerToBytes(y, len));
	}
	return enc;
};

ECPointFp.decodeFrom = function (curve, enc) {
	var type = enc.shift();

	// Extract x and y as byte arrays
	var xBa = enc.slice(0, enc.length/2);
	var yBa = enc.slice(enc.length/2, enc.length);

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
	/*console.log("b.y: ", Crypto.util.bytesToHex(b.y.toBigInteger().toByteArrayUnsigned()));
console.log("this.y: ", Crypto.util.bytesToHex(this.y.toBigInteger().toByteArrayUnsigned()));
console.log("b.y-this.y: ", Crypto.util.bytesToHex(b.y.subtract(this.y).toBigInteger().toByteArrayUnsigned()));*/
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

		console.log(P.curve, Q.curve);
		console.log("Px: ", Crypto.util.bytesToHex(P.x.toBigInteger().toByteArrayUnsigned()));
		console.log("Py: ", Crypto.util.bytesToHex(P.y.toBigInteger().toByteArrayUnsigned()));
		console.log("Pz: ", Crypto.util.bytesToHex(P.z.toByteArrayUnsigned()));
		console.log("Qx: ", Crypto.util.bytesToHex(Q.x.toBigInteger().toByteArrayUnsigned()));
		console.log("Qy: ", Crypto.util.bytesToHex(Q.y.toBigInteger().toByteArrayUnsigned()));
		console.log("Qz: ", Crypto.util.bytesToHex(Q.z.toByteArrayUnsigned()));
		console.log("Zx: ", Crypto.util.bytesToHex(Z.x.toBigInteger().toByteArrayUnsigned()));
		console.log("Zy: ", Crypto.util.bytesToHex(Z.y.toBigInteger().toByteArrayUnsigned()));
		console.log("Zz: ", Crypto.util.bytesToHex(Z.z.toByteArrayUnsigned()));
		
		for (var i = m - 1; i >= 0; --i) {
			R = R.twice2D();

			R.z = BigInteger.ONE;

			if (k.testBit(i)) {
				if (l.testBit(i)) {
					R = R.add2D(Z);
					if (i > (m-5)) console.log("RC: 1");
				} else {
					R = R.add2D(P);
					if (i > (m-5)) console.log("RC: 2");
				}
			} else {
				if (l.testBit(i)) {
					R = R.add2D(Q);
					if (i > (m-5)) console.log("RC: 3");
				} else {
					if (i > (m-5)) console.log("RC: 4");
				}
			}
			if (i > (m-5)) {
		console.log("Rx: ", Crypto.util.bytesToHex(R.x.toBigInteger().toByteArrayUnsigned()));
		console.log("Ry: ", Crypto.util.bytesToHex(R.y.toBigInteger().toByteArrayUnsigned()));
		console.log("Rz: ", Crypto.util.bytesToHex(R.z.toByteArrayUnsigned()));
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

			console.log("signhash: "+ Crypto.util.bytesToHex(hash));
			console.log("e: "+ Crypto.util.bytesToHex(e.toByteArrayUnsigned()));
			
			do {
				var k = ECDSA.getBigRandom(n);
				var G = ecparams.getG();
				var Q = G.multiply(k);
				var r = Q.getX().toBigInteger().mod(n);
			} while (r.compareTo(BigInteger.ZERO) <= 0);

			console.log("k: "+ Crypto.util.bytesToHex(k.toByteArrayUnsigned()));
			console.log("r: "+ Crypto.util.bytesToHex(r.toByteArrayUnsigned()));

			var s = k.modInverse(n).multiply(e.add(d.multiply(r))).mod(n);

			console.log("d*r: "+ Crypto.util.bytesToHex(d.multiply(r).toByteArrayUnsigned()));
			console.log("e+d*r: "+ Crypto.util.bytesToHex(e.add(d.multiply(r)).toByteArrayUnsigned()));
			console.log("s: "+ Crypto.util.bytesToHex(s.toByteArrayUnsigned()));
			
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
			sequence.unshift(0x30) // SEQUENCE

			return sequence;
		},

		verify: function (hash, sig, pubkey) {
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
			//	throw new Error("Extra bytes in signature");

			var n = ecparams.getN();
			var e = BigInteger.fromByteArrayUnsigned(hash);

			console.log("e: "+ Crypto.util.bytesToHex(e.toByteArrayUnsigned()));

			var r = BigInteger.fromByteArrayUnsigned(rBa);
			var s = BigInteger.fromByteArrayUnsigned(sBa);

			if (r.compareTo(BigInteger.ONE) < 0 ||
				r.compareTo(n) >= 0)
				return false;

			if (s.compareTo(BigInteger.ONE) < 0 ||
				s.compareTo(n) >= 0)
				return false;

			var c = s.modInverse(n);

			var u1 = e.multiply(c).mod(n);
			var u2 = r.multiply(c).mod(n);

			console.log("r: "+ Crypto.util.bytesToHex(r.toByteArrayUnsigned()));
			console.log("u1: "+ Crypto.util.bytesToHex(u1.toByteArrayUnsigned()));
			console.log("u2: "+ Crypto.util.bytesToHex(u2.toByteArrayUnsigned()));
			
			var G = ecparams.getG();
			var Q = ECPointFp.decodeFrom(ecparams.getCurve(), pubkey);

			console.log("G.x: ", Crypto.util.bytesToHex(G.x.toBigInteger().toByteArrayUnsigned()));
			console.log("G.y: ", Crypto.util.bytesToHex(G.y.toBigInteger().toByteArrayUnsigned()));
			console.log("Q.x: ", Crypto.util.bytesToHex(Q.x.toBigInteger().toByteArrayUnsigned()));
			console.log("Q.y: ", Crypto.util.bytesToHex(Q.y.toBigInteger().toByteArrayUnsigned()));
			
			var point = implShamirsTrick(G, u1, Q, u2);

			console.log("P.x: ", Crypto.util.bytesToHex(point.x.toBigInteger().toByteArrayUnsigned()));
			console.log("P.y: ", Crypto.util.bytesToHex(point.y.toBigInteger().toByteArrayUnsigned()));
			
			var v = point.x.toBigInteger().mod(n);

			return v.equals(r);
		}
	};

	return ECDSA;
})();
