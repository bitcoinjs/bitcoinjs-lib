// Named EC curves

var BigInteger = require('bigi')
var ECCurveFp = require('./ec')
var ECPointFp = ECCurveFp.ECPointFp

// ----------------
// X9ECParameters

// constructor
function X9ECParameters(curve,g,n,h) {
    this.curve = curve
    this.g = g
    this.n = n
    this.h = h
}

function x9getCurve() {
    return this.curve
}

function x9getG() {
    return this.g
}

function x9getN() {
    return this.n
}

function x9getH() {
    return this.h
}

X9ECParameters.prototype.getCurve = x9getCurve
X9ECParameters.prototype.getG = x9getG
X9ECParameters.prototype.getN = x9getN
X9ECParameters.prototype.getH = x9getH

function secp256r1() {
    // p = 2^224 (2^32 - 1) + 2^192 + 2^96 - 1
    var p = BigInteger.fromHex("FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF")
    var a = BigInteger.fromHex("FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC")
    var b = BigInteger.fromHex("5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B")
    //byte[] S = BigInteger.fromHex("C49D360886E704936A6678E1139D26B7819F7E90")
    var n = BigInteger.fromHex("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551")
    var h = BigInteger.ONE
    var curve = new ECCurveFp(p, a, b)

    var x = BigInteger.fromHex("6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296")
    var y = BigInteger.fromHex("4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5")
    var G = new ECPointFp(curve,
                          curve.fromBigInteger(x),
                          curve.fromBigInteger(y))

    return new X9ECParameters(curve, G, n, h)
}

function secp256k1() {
    // p = 2^256 - 2^32 - 2^9 - 2^8 - 2^7 - 2^6 - 2^4 - 1
    var p = BigInteger.fromHex("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F")
    var a = BigInteger.ZERO
    var b = BigInteger.fromHex("07")
    //byte[] S = null
    var n = BigInteger.fromHex("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141")
    var h = BigInteger.ONE
    var curve = new ECCurveFp(p, a, b)

    var x = BigInteger.fromHex("79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798")
    var y = BigInteger.fromHex("483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8")
    var G = new ECPointFp(curve,
                          curve.fromBigInteger(x),
                          curve.fromBigInteger(y))

    return new X9ECParameters(curve, G, n, h)
}

function getSECCurveByName(name) {
    return ({
      "secp256k1": secp256k1,
      "secp256r1": secp256r1
    }[name])()
}

module.exports = getSECCurveByName
