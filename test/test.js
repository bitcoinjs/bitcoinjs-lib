//
// Testing elliptic curve math
// -----------------------------------------------------------------------------
module("ec");

var ecparams = getSECCurveByName("secp256k1");
var rng = new SecureRandom();

test("Classes", function () {
  expect(3);
  ok(ECPointFp, "ECPointFp");
  ok(ECFieldElementFp, "ECFieldElementFp");
  ok(ECCurveFp, "ECCurveFp");
});

test("Point multiplication", function () {
	expect(5);

	var G = ecparams.getG();
	var n = ecparams.getN();

	ok(G.multiply(n).isInfinity(), "Gn is infinite");

  var k = Bitcoin.ECDSA.getBigRandom(n);
  var P = G.multiply(k);
	ok(!P.isInfinity(), "kG is not infinite");
	ok(P.isOnCurve(), "kG on curve");
	ok(P.multiply(n).isInfinity(), "kGn is infinite");

  ok(P.validate(), "kG validates as a public key");
});
