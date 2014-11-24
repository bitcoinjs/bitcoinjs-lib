var assert = require('assert')

var bitcoin = require('../../')
var crypto = require('crypto')
var sinon = require('sinon')

describe('bitcoinjs-lib (README)', function() {
  it('can generate a random bitcoin address', sinon.test(function() {
    // for testing only
    this.mock(crypto).expects('randomBytes')
      .onCall(0).returns(new Buffer('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'))

    // generate random key
    var key = bitcoin.ECKey.makeRandom()
    var address = key.pub.getAddress().toString()

    assert.equal(address, '1F5VhMHukdnUES9kfXqzPzMeF1GPHKiF64')
  }))

  it('can import a WIF encoded private key', function() {
    var key = bitcoin.ECKey.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    var address = key.pub.getAddress().toString()

    assert.equal(address, '19AAjaTUbRjQCMuVczepkoPswiZRhjtg31')
  })

  it('can create a Transaction', function() {
    var key = bitcoin.ECKey.fromWIF("L1uyy5qTuGrVXrmrsvHWHgVzW9kKdrp27wBC7Vs6nZDTF2BRUVwy")
    var tx = new bitcoin.TransactionBuilder()

    tx.addInput("aa94ab02c182214f090e99a0d57021caffd0f195a81c24602b1028b130b63e31", 0)
    tx.addOutput("1Gokm82v6DmtwKEB8AiVhm82hyFSsEvBDK", 15000)
    tx.sign(0, key)

    assert.equal(tx.build().toHex(), '0100000001313eb630b128102b60241ca895f1d0ffca2170d5a0990e094f2182c102ab94aa000000006b483045022100aefbcf847900b01dd3e3debe054d3b6d03d715d50aea8525f5ea3396f168a1fb022013d181d05b15b90111808b22ef4f9ebe701caf2ab48db269691fdf4e9048f4f60121029f50f51d63b345039a290c94bffd3180c99ed659ff6ea6b1242bca47eb93b59fffffffff01983a0000000000001976a914ad618cf4333b3b248f9744e8e81db2964d0ae39788ac00000000')
  })

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

  it('can create a P2SH Multisig Address', function() {
    var pubKeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map(bitcoin.ECPubKey.fromHex)

    var redeemScript = bitcoin.scripts.multisigOutput(2, pubKeys) // 2 of 3
    var scriptPubKey = bitcoin.scripts.scriptHashOutput(redeemScript.getHash())
    var address = bitcoin.Address.fromOutputScript(scriptPubKey).toString()

    assert.equal(address, '36NUkt6FWUi3LAWBqWRdDmdTWbt91Yvfu7')
  })
})
