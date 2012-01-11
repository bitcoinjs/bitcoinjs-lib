/**
 * Implement the Paillier cryptosystem in JavaScript.
 *
 * Paillier is useful for multiparty calculation. It is not currently part of any
 * BitcoinJS-lib distribution, but it is included here for experimental use.
 */
Bitcoin.Paillier = (function () {
  var rng = new SecureRandom();
  var TWO = BigInteger.valueOf(2);

  var Paillier = {
    generate: function (bitLength) {
      var p, q;
      do {
        p = new BigInteger(bitLength, 1, rng);
        q = new BigInteger(bitLength, 1, rng);
      } while (p.equals(q));

      var n = p.multiply(q);

      // p - 1
      var p1 = p.subtract(BigInteger.ONE);
      // q - 1
      var q1 = q.subtract(BigInteger.ONE);

      var nSq = n.multiply(n);

      // lambda
      var l = p1.multiply(q1).divide(p1.gcd(q1));

      var coprimeBitLength = n.bitLength() - Math.floor(Math.random()*10);

      var alpha = new BigInteger(coprimeBitLength, 1, rng);
      var beta = new BigInteger(coprimeBitLength, 1, rng);

      var g = alpha.multiply(n).add(BigInteger.ONE)
        .multiply(beta.modPow(n,nSq)).mod(nSq);

      // mu
      var m = g.modPow(l,nSq).mod(nSq)
        .subtract(BigInteger.ONE).divide(n).modInverse(n);

      return new Paillier.PrivateKey(n,g,l,m,nSq);
    }
  };

  Paillier.PublicKey = function (n,g,nSq) {
    this.n = n;
    this.g = g;
    this.nSq = nSq || n.multiply(n);
  };

  Paillier.PublicKey.prototype.encrypt = function (i, r) {
    if (!r) {
      var coprimeBitLength = this.n.bitLength() - Math.floor(Math.random()*10);
      r = new BigInteger(coprimeBitLength, 1, rng);
    }
    return this.g.modPow(i,this.nSq).multiply(r.modPow(this.n,this.nSq))
      .mod(this.nSq);
  };

  Paillier.PublicKey.prototype.add = function (c, f) {
    return c.multiply(this.encrypt(f)).mod(this.nSq);
  };

  Paillier.PublicKey.prototype.addCrypt = function (c, f) {
    return c.multiply(f).mod(this.nSq);
  };

  Paillier.PublicKey.prototype.multiply = function (c, f) {
    return c.modPow(f, this.nSq);
  };

  Paillier.PublicKey.prototype.rerandomize = function (c, r) {
    if (!r) {
      var coprimeBitLength = this.n.bitLength() - Math.floor(Math.random()*10);
      r = new BigInteger(coprimeBitLength, 1, rng);
    }
    return c.multiply(r.modPow(this.n, this.nSq)).mod(this.nSq);
  };

  Paillier.PrivateKey = function (n,g,l,m,nSq) {
    this.l = l;
    this.m = m;
    this.n = n;
    this.nSq = nSq || n.multiply(n);
    this.pub = new Paillier.PublicKey(n,g,this.nSq);
  };

  Paillier.PrivateKey.prototype.decrypt = function (c) {
    return c.modPow(this.l, this.nSq).subtract(BigInteger.ONE)
      .divide(this.n).multiply(this.m).mod(this.n);
  };

  Paillier.PrivateKey.prototype.decryptR = function (c, i) {
    if (!i) {
      i = this.decrypt(c);
    }
    var rn = c.multiply(this.pub.g.modPow(i, this.nSq).modInverse(this.nSq))
      .mod(this.nSq);
    var a = this.l.modInverse(this.n).multiply(this.n.subtract(BigInteger.ONE));
    var e = a.multiply(this.l).add(BigInteger.ONE).divide(this.n);
    return rn.modPow(e, this.n);
  };

  function createProxyMethod(name) {
    return function () {
      return this.pub[name].apply(this.pub,
                                  Array.prototype.slice.apply(arguments));
    };
  };
  var a = ["add", "addCrypt", "multiply", "rerandomize", "encrypt"];
  for (var i = 0, l = a.length; i < l; i++) {
    Paillier.PrivateKey.prototype[a[i]] = createProxyMethod(a[i]);
  }

  return Paillier;
})();
