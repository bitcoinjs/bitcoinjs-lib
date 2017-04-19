/* global describe, it */

var assert = require('assert')
var bigi = require('bigi')
var bip39 = require('bip39')
var bitcoin = require('../../')
var crypto = require('crypto')

var ecurve = require('ecurve')
var secp256k1 = ecurve.getCurveByName('secp256k1')

describe('bitcoinjs-lib (BIP32)', function () {
  it('can import a BIP32 testnet xpriv and export to WIF', function () {
    var xpriv = 'tprv8ZgxMBicQKsPd7Uf69XL1XwhmjHopUGep8GuEiJDZmbQz6o58LninorQAfcKZWARbtRtfnLcJ5MQ2AtHcQJCCRUcMRvmDUjyEmNUWwx8UbK'
    var node = bitcoin.HDNode.fromBase58(xpriv, bitcoin.networks.testnet)

    assert.equal(node.keyPair.toWIF(), 'cQfoY67cetFNunmBUX5wJiw3VNoYx3gG9U9CAofKE6BfiV1fSRw7')
  })

  it('can create a BIP32 wallet external address', function () {
    var path = "m/0'/0/0"
    var root = bitcoin.HDNode.fromSeedHex('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')

    var child1 = root.derivePath(path)

    // option 2, manually
    var child2 = root.deriveHardened(0)
      .derive(0)
      .derive(0)

    assert.equal(child1.getAddress(), '1JHyB1oPXufr4FXkfitsjgNB5yRY9jAaa7')
    assert.equal(child2.getAddress(), '1JHyB1oPXufr4FXkfitsjgNB5yRY9jAaa7')
  })

  it('can create a BIP44, bitcoin, account 0, external address', function () {
    var path = "m/44'/0'/0'/0/0"
    var root = bitcoin.HDNode.fromSeedHex('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')

    var child1 = root.derivePath(path)

    // option 2, manually
    var child2 = root.deriveHardened(44)
      .deriveHardened(0)
      .deriveHardened(0)
      .derive(0)
      .derive(0)

    assert.equal(child1.getAddress(), '12Tyvr1U8A3ped6zwMEU5M8cx3G38sP5Au')
    assert.equal(child2.getAddress(), '12Tyvr1U8A3ped6zwMEU5M8cx3G38sP5Au')
  })

  it('can recover a BIP32 parent private key from the parent public key, and a derived, non-hardened child private key', function () {
    function recoverParent (master, child) {
      assert(!master.keyPair.d, 'You already have the parent private key')
      assert(child.keyPair.d, 'Missing child private key')

      var curve = secp256k1
      var QP = master.keyPair.Q
      var serQP = master.keyPair.getPublicKeyBuffer()

      var d1 = child.keyPair.d
      var d2
      var data = new Buffer(37)
      serQP.copy(data, 0)

      // search index space until we find it
      for (var i = 0; i < bitcoin.HDNode.HIGHEST_BIT; ++i) {
        data.writeUInt32BE(i, 33)

        // calculate I
        var I = crypto.createHmac('sha512', master.chainCode).update(data).digest()
        var IL = I.slice(0, 32)
        var pIL = bigi.fromBuffer(IL)

        // See hdnode.js:273 to understand
        d2 = d1.subtract(pIL).mod(curve.n)

        var Qp = new bitcoin.ECPair(d2).Q
        if (Qp.equals(QP)) break
      }

      var node = new bitcoin.HDNode(new bitcoin.ECPair(d2), master.chainCode, master.network)
      node.depth = master.depth
      node.index = master.index
      node.masterFingerprint = master.masterFingerprint
      return node
    }

    var seed = crypto.randomBytes(32)
    var master = bitcoin.HDNode.fromSeedBuffer(seed)
    var child = master.derive(6) // m/6

    // now for the recovery
    var neuteredMaster = master.neutered()
    var recovered = recoverParent(neuteredMaster, child)
    assert.strictEqual(recovered.toBase58(), master.toBase58())
  })

  it('can use BIP39 to generate BIP32 wallet address', function () {
//     var mnemonic = bip39.generateMnemonic()
    var mnemonic = 'praise you muffin lion enable neck grocery crumble super myself license ghost'
    assert(bip39.validateMnemonic(mnemonic))

    var seed = bip39.mnemonicToSeed(mnemonic)
    var root = bitcoin.HDNode.fromSeedBuffer(seed)

    // 1st receive address
    assert.strictEqual(root.derivePath("m/0'/0/0").getAddress(), '1AVQHbGuES57wD68AJi7Gcobc3RZrfYWTC')

    // 1st change address
    assert.strictEqual(root.derivePath("m/0'/1/0").getAddress(), '1349KVc5NgedaK7DvuD4xDFxL86QN1Hvdn')
  })
})
