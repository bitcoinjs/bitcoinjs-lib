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

function start() {
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

  Alice.prototype.getPubShare = function () {
    return G.multiply(this.d1);
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

    var Q_1 = G.multiply(this.k1);
    ff('q1', Q_1);

    var alpha = this.paillier.encrypt(this.z1);
    ff('alpha', alpha);

    var beta = this.paillier.encrypt(this.d1.multiply(this.z1).mod(n));
    ff('beta', beta);

    var r_1 = Q_1.getX().toBigInteger().mod(n);
    var A = this.paillier.encrypt(Bitcoin.ECDSA.getBigRandom(this.paillier.n.divide(n)));
    ff('A', A);
    var s_a = this.paillier.multiply(alpha, this.e);
    var s_b = this.paillier.multiply(beta, r_1);
    var sigma_1 = this.paillier.addCrypt(this.paillier.addCrypt(s_a, s_b), this.paillier.multiply(A, n));
    ff('sigma_1', sigma_1);

    var e = Crypto.SHA256(sigma_1.toByteArrayUnsigned(), {asBytes: true});
    e = BigInteger.fromByteArrayUnsigned(e);
    var sigma_1n = this.paillier.rerandomize(sigma_1, e);
    ff('sigma_1n', sigma_1n);

    var s_1 = this.paillier.decrypt(sigma_1n);
    ff('s_1', s_1);
    var v_n = this.paillier.decryptR(sigma_1n, s_1);
    ff('v_n', v_n);

    return {
      Q_1: Q_1,
      P_1: this.getPubShare(),
      alpha: alpha,
      beta: beta,
      message: message,
      paillier: this.paillier.pub,
      A: A,
      s_1: s_1,
      v_n: v_n
    };
  };

  Bob.prototype.step2 = function (pkg) {
    // ... In real life we would check that message is a valid transaction and
    //     does what we want.

    // Throws exception on error
    pkg.Q_1.validate();

    var hash = Crypto.SHA256(Crypto.SHA256(message, {asBytes: true}), {asBytes: true});
    this.e = BigInteger.fromByteArrayUnsigned(hash).mod(n);

    this.paillier = pkg.paillier;
    this.alpha = pkg.alpha;
    this.beta = pkg.beta;

    var r_1 = pkg.Q_1.getX().toBigInteger().mod(n);
    var testSig = Bitcoin.ECDSA.serializeSig(r_1, pkg.s_1.mod(n));
    if (!Bitcoin.ECDSA.verify(hash, testSig, pkg.P_1.getEncoded())) {
      throw new Error('Verification of s1 failed.');
    }

    // Verify that alpha and beta are valid by generating and verifying sigma_1n
    var s_a_1 = this.paillier.multiply(this.alpha, this.e);
    var s_b_1 = this.paillier.multiply(this.beta, r_1);
    var sigma_1 = this.paillier.addCrypt(this.paillier.addCrypt(s_a_1, s_b_1), this.paillier.multiply(pkg.A, n));

    var e = Crypto.SHA256(sigma_1.toByteArrayUnsigned(), {asBytes: true});
    e = BigInteger.fromByteArrayUnsigned(e);
    var sigma_1n = this.paillier.rerandomize(sigma_1, e);
    ff('sigma_1n_b', sigma_1n);

    var sigma_1_verify = this.paillier.encrypt(pkg.s_1, pkg.v_n);
    if (!sigma_1n.equals(sigma_1_verify)) {
      throw new Error('Sigma ciphertext did not match expected value.');
    }

    this.k2 = Bitcoin.ECDSA.getBigRandom(n);
    ff('k2', this.k2);

    this.z2 = this.k2.modInverse(n);
    ff('z2', this.z2);

    var Q_2 = G.multiply(this.k2);
    ff('q2', Q_2);

    var Q = pkg.Q_1.multiply(this.k2);
    this.r = Q.getX().toBigInteger().mod(n);
    ff('r', this.r);

    if (this.r.equals(BigInteger.ZERO)) {
      throw new Error('r must not be zero.');
    }

    var B = Bitcoin.ECDSA.getBigRandom(this.paillier.n.divide(n));
    ff('B', B);

    var p = this.paillier;
    var s_a = p.multiply(this.alpha, this.e.multiply(this.z2));
    var s_b = p.multiply(this.beta, this.r.multiply(this.d2).multiply(this.z2));
    var sigma = p.add(p.addCrypt(s_a, s_b), B.multiply(n));
    ff('sigma', sigma);

    return {
      Q_2: Q_2,
      r: this.r,
      sigma: sigma
    };
  };

  Alice.prototype.step3 = function (pkg) {
    pkg.Q_2.validate();

    var Q = pkg.Q_2.multiply(this.k1);
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

  var ver = Bitcoin.ECDSA.verify(hash, sig, pub);
  log("ver    :", ver);
  log("ver/CHK:", Bitcoin.ECDSA.verify(hash, sigChk, pub));
  log("ver/CTL:", Bitcoin.ECDSA.verify(hash, Bitcoin.ECDSA.sign(hash, dChk), pub));
  ff("result", ver ? "SIGNATURE VALID" : "SIGNATURE INVALID");

  var priv = Bitcoin.ECDSA.getBigRandom(n);
  pub = G.multiply(priv).getEncoded();
  log("ver/GEN:", Bitcoin.ECDSA.verify(hash, Bitcoin.ECDSA.sign(hash, priv), pub));
};

self.onmessage = function (event) {
  try {
    start();
  } catch(e) {
    var stack = e.stack.replace(/^[^\(]+?[\n$]/gm, '')
      .replace(/^\s+at\s+/gm, '')
      .replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@')
      .split('\n');
    log(e+'\n'+stack);
  }
};
