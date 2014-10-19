var assert = require('assert')

var bigi = require('bigi')
var bitcoin = require('../../')

describe('bitcoinjs-lib (darkwallet examples)', function() {
  it('can generate a single-key stealth address', function() {
    var receiver = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
    var sender = bitcoin.ECKey.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct') // XXX: ephemeral, must be random to preserve privacy

    var G = bitcoin.ECKey.curve.G
    var d = receiver.d // secret (receiver only)
    var Q = receiver.pub.Q // shared

    var e = sender.d // secret (sender only)
    var P = sender.pub.Q // shared

    // derived shared secret
    var eQ = Q.multiply(e) // sender
    var dP = P.multiply(d) // receiver
    assert.deepEqual(eQ.getEncoded(), dP.getEncoded())

    var c = bigi.fromBuffer(bitcoin.crypto.sha256(eQ.getEncoded()))
    var cG = G.multiply(c)

    // derived public key
    var QprimeS = Q.add(cG)
    var QprimeR = G.multiply(d.add(c))
    assert.deepEqual(QprimeR.getEncoded(), QprimeS.getEncoded())

    // derived shared-secret address
    var address = new bitcoin.ECPubKey(QprimeS).getAddress().toString()

    assert.equal(address, '1EwCNJNZM5q58YPPTnjR1H5BvYRNeyZi47')
  })

  // TODO
  it.skip('can generate a dual-key stealth address', function() {})
})
