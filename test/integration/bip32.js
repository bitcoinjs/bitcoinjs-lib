/* global describe, it */

var assert = require('assert')
var bip39 = require('bip39')
var bitcoin = require('../../')

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

  it('can create a BIP49, bitcoin testnet, account 0, external address', function () {
    var mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    var seed = bip39.mnemonicToSeed(mnemonic)
    var root = bitcoin.HDNode.fromSeedBuffer(seed)

    var path = "m/49'/1'/0'/0/0"
    var child = root.derivePath(path)

    var keyhash = bitcoin.crypto.hash160(child.getPublicKeyBuffer())
    var scriptSig = bitcoin.script.witnessPubKeyHash.output.encode(keyhash)
    var addressBytes = bitcoin.crypto.hash160(scriptSig)
    var outputScript = bitcoin.script.scriptHash.output.encode(addressBytes)
    var address = bitcoin.address.fromOutputScript(outputScript, bitcoin.networks.testnet)

    assert.equal(address, '2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2')
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
