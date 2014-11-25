var assert = require('assert')

var bigi = require('bigi')
var bitcoin = require('../../')

describe('bitcoinjs-lib (advanced)', function() {
  it('can sign a Bitcoin message', function() {
    var key = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')
    var message = 'This is an example of a signed message.'

    var signature = bitcoin.Message.sign(key, message)
    assert.equal(signature.toString('base64'), 'G9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=')
  })

  it('can verify a Bitcoin message', function() {
    var address = '1HZwkjkeaoZfTSaJxDw6aKkxp45agDiEzN'
    var signature = 'HJLQlDWLyb1Ef8bQKEISzFbDAKctIlaqOpGbrk3YVtRsjmC61lpE5ErkPRUFtDKtx98vHFGUWlFhsh3DiW6N0rE'
    var message = 'This is an example of a signed message.'

    assert(bitcoin.Message.verify(address, signature, message))
  })

  it('can generate a single-key stealth address', function() {
    var receiver = bitcoin.ECKey.fromWIF('5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss')

    // XXX: ephemeral, must be random (and secret to sender) to preserve privacy
    var sender = bitcoin.ECKey.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')

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

  it('can create an OP_RETURN transaction', function() {
    var key = bitcoin.ECKey.fromWIF("L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy")
    var tx = new bitcoin.TransactionBuilder()

    var data = new Buffer('cafedeadbeef', 'hex')
    var dataScript = bitcoin.scripts.dataOutput(data)

    tx.addInput("aa94ab02c182214f090e99a0d57021caffd0f195a81c24602b1028b130b63e31", 0)
    tx.addOutput(dataScript, 1000)
    tx.sign(0, key)

    assert.equal(tx.build().toHex(), '0100000001313eb630b128102b60241ca895f1d0ffca2170d5a0990e094f2182c102ab94aa000000006a4730440220578f9df41a0e5c5052ad6eef46d005b41f966c7fda01d5f71e9c65026c9025c002202e0159ea0db47ca1bf7713e3a08bbba8cc4fdd90a2eff12591c42049c7cad6c30121029f50f51d63b345039a290c94bffd3180c99ed659ff6ea6b1242bca47eb93b59fffffffff01e803000000000000086a06cafedeadbeef00000000')
  })
})
