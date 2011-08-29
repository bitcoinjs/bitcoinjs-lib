var window = this;

importScripts(
  "../src/crypto-js/crypto.js",
  "../src/crypto-js/sha256.js",
  "../src/jsbn/prng4.js",
  "../src/jsbn/rng.js",
  "../src/jsbn/jsbn.js",
  "../src/jsbn/jsbn2.js",

  "../src/jsbn/ec.js",
  "../src/jsbn/sec.js",
  "../src/events/eventemitter.js",
  "../src/bitcoin.js",
  "../src/util.js",
  "../src/base58.js",

  "../src/address.js",
  "../src/ecdsa.js",
  "../src/paillier.js"
);

function hex(value) {
  if ("function" === typeof value.getEncoded) {
    return Crypto.util.bytesToHex(value.getEncoded());
  } else if ("function" === typeof value.toByteArrayUnsigned) {
    return Crypto.util.bytesToHex(value.toByteArrayUnsigned());
  } else if (Array.isArray(value)) {
    return Crypto.util.bytesToHex(value);
  }
  return value;
};
function ff(field, value) {
  value = hex(value);
  postMessage({ "cmd": "ff", "field": field, "value": value });
};

function log() {
  postMessage({ "cmd": "log", "args": Array.prototype.slice.apply(arguments) });
};

self.onmessage = function (event) {
  var ecparams = getSECCurveByName("secp256k1");
  var rng = new SecureRandom();

  var G = ecparams.getG();
  var n = ecparams.getN();

  G.validate();

  var Alice = function (pubShare) {
    this.d1 = Bitcoin.ECDSA.getBigRandom(n);
    ff('d1', this.d1);

    this.paillier = Bitcoin.Paillier.generate(n.bitLength()*2+
                                              Math.floor(Math.random()*10));

    ff('p1_n', this.paillier.pub.n);
    ff('p1_g', this.paillier.pub.g);
    ff('p1_l', this.paillier.l);
    ff('p1_m', this.paillier.m);
  };
  var Bob = function () {
    this.d2 = Bitcoin.ECDSA.getBigRandom(n);
    ff('d2', this.d2);
  };

  Alice.prototype.getPub = function (P) {
    if (this.pub) return this.pub;

    P.validate();

    return this.pub = P.multiply(this.d1).getEncoded();
  };

  Bob.prototype.getPubShare = function () {
    return G.multiply(this.d2);
  };

  Alice.prototype.step1 = function (message) {
    var hash = Crypto.SHA256(Crypto.SHA256(message, {asBytes: true}), {asBytes: true});
    this.e = BigInteger.fromByteArrayUnsigned(hash).mod(n);

    this.k1 = Bitcoin.ECDSA.getBigRandom(n);
    ff('k1', this.k1);

    this.z1 = this.k1.modInverse(n);
    ff('z1', this.z1);

    var Q1 = G.multiply(this.k1);
    ff('q1', Q1);

    var alpha = this.paillier.encrypt(this.z1);
    var beta = this.paillier.encrypt(this.d1.multiply(this.z1).mod(n));

    ff('alpha', alpha);
    ff('beta', beta);

    // TODO: Generate a proof that alpha and beta are safe

    return {
      message: message,
      e: this.e,
      Q1: Q1,
      alpha: alpha,
      beta: beta,
      paillier: this.paillier.pub
    };
  };

  Bob.prototype.step2 = function (pkg) {
    // ... In real life we would check that message is a valid transaction and
    //     does what we want.

    // Throws exception on error
    pkg.Q1.validate();

    var hash = Crypto.SHA256(Crypto.SHA256(message, {asBytes: true}), {asBytes: true});
    this.e = BigInteger.fromByteArrayUnsigned(hash).mod(n);

    if (!this.e.equals(pkg.e)) {
      throw new Error('We arrived at different values for e.');
    }

    this.paillier = pkg.paillier;
    this.alpha = pkg.alpha;
    this.beta = pkg.beta;

    this.k2 = Bitcoin.ECDSA.getBigRandom(n);
    ff('k2', this.k2);

    this.z2 = this.k2.modInverse(n);
    ff('z2', this.z2);

    var Q2 = G.multiply(this.k2);
    ff('q2', Q2);

    var Q = pkg.Q1.multiply(this.k2);
    this.r = Q.getX().toBigInteger().mod(n);
    ff('r', this.r);

    if (this.r.equals(BigInteger.ZERO)) {
      throw new Error('r must not be zero.');
    }

    var c = Bitcoin.ECDSA.getBigRandom(this.paillier.n.divide(n));
    ff('c', c);

    var p = this.paillier;
    var s_a = p.multiply(this.alpha, this.e.multiply(this.z2));
    var s_b = p.multiply(this.beta, this.r.multiply(this.d2).multiply(this.z2));
    var sigma = p.add(p.addCrypt(s_a, s_b), c.multiply(n));
    ff('sigma', sigma);

    return {
      Q2: Q2,
      r: this.r,
      sigma: sigma
    };
  };

  Alice.prototype.step3 = function (pkg) {
    pkg.Q2.validate();

    var Q = pkg.Q2.multiply(this.k1);
    this.r = Q.getX().toBigInteger().mod(n);

    if (!this.r.equals(pkg.r)) {
      throw new Error('Could not confirm value for r.');
    }

    if (this.r.equals(BigInteger.ZERO)) {
      throw new Error('r must not be zero.');
    }

    var s = this.paillier.decrypt(pkg.sigma).mod(n);
    ff('s', s);

    var sig = Bitcoin.ECDSA.serializeSig(this.r, s);

    var hash = this.e.toByteArrayUnsigned();
    if (!Bitcoin.ECDSA.verify(hash, sig, this.getPub())) {
      throw new Error('Signature failed to verify.');
    }

    return {
      r: this.r,
      s: s
    };
  };

  var message = "testmessage";

  var bob = new Bob();
  var pubShare = bob.getPubShare();

  var alice = new Alice(pubShare);
  var pub = alice.getPub(pubShare);

  var pkg1 = alice.step1(message);
  var pkg2 = bob.step2(pkg1);
  var pkg3 = alice.step3(pkg2);

  var sig = Bitcoin.ECDSA.serializeSig(pkg3.r, pkg3.s);

  var kChk = alice.k1.multiply(bob.k2);
  var rChk = G.multiply(kChk).getX().toBigInteger();
  log("r    :", hex(pkg3.r));
  log("r/CHK:", hex(rChk));

  var hash = Crypto.SHA256(Crypto.SHA256(message, {asBytes: true}), {asBytes: true});
  var eChk = BigInteger.fromByteArrayUnsigned(hash).mod(n);
  var dChk = alice.d1.multiply(bob.d2);
  var sChk = kChk.modInverse(n).multiply(eChk.add(dChk.multiply(rChk))).mod(n);
  log("s    :", hex(pkg3.s));
  log("s/CHK:", hex(sChk));

  var sigChk = Bitcoin.ECDSA.serializeSig(rChk, sChk);
  log("sig    :", hex(sig));
  log("sig/CHK:", hex(sigChk));

  log("ver    :", Bitcoin.ECDSA.verify(hash, sig, pub));
  log("ver/CHK:", Bitcoin.ECDSA.verify(hash, sigChk, pub));
  log("ver/CTL:", Bitcoin.ECDSA.verify(hash, Bitcoin.ECDSA.sign(hash, dChk), pub));

  var priv = Bitcoin.ECDSA.getBigRandom(n);
  pub = G.multiply(priv).getEncoded();
  log("ver/GEN:", Bitcoin.ECDSA.verify(hash, Bitcoin.ECDSA.sign(hash, priv), pub));
};
