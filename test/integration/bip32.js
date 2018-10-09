const { describe, it } = require('mocha')
const assert = require('assert')
const bip32 = require('bip32')
const bip39 = require('bip39')
const bitcoin = require('../../')

function getAddress (node, network) {
  return bitcoin.payments.p2pkh({ pubkey: node.publicKey, network }).address
}

describe('bitcoinjs-lib (BIP32)', function () {
  it('can import a BIP32 testnet xpriv and export to WIF', function () {
    const xpriv = 'tprv8ZgxMBicQKsPd7Uf69XL1XwhmjHopUGep8GuEiJDZmbQz6o58LninorQAfcKZWARbtRtfnLcJ5MQ2AtHcQJCCRUcMRvmDUjyEmNUWwx8UbK'
    const node = bip32.fromBase58(xpriv, bitcoin.networks.testnet)

    assert.equal(node.toWIF(), 'cQfoY67cetFNunmBUX5wJiw3VNoYx3gG9U9CAofKE6BfiV1fSRw7')
  })

  it('can export a BIP32 xpriv, then import it', function () {
    const mnemonic = 'praise you muffin lion enable neck grocery crumble super myself license ghost'
    const seed = bip39.mnemonicToSeed(mnemonic)
    const node = bip32.fromSeed(seed)
    const string = node.toBase58()
    const restored = bip32.fromBase58(string)

    assert.equal(getAddress(node), getAddress(restored)) // same public key
    assert.equal(node.toWIF(), restored.toWIF()) // same private key
  })

  it('can export a BIP32 xpub', function () {
    const mnemonic = 'praise you muffin lion enable neck grocery crumble super myself license ghost'
    const seed = bip39.mnemonicToSeed(mnemonic)
    const node = bip32.fromSeed(seed)
    const string = node.neutered().toBase58()

    assert.equal(string, 'xpub661MyMwAqRbcGhVeaVfEBA25e3cP9DsJQZoE8iep5fZSxy3TnPBNBgWnMZx56oreNc48ZoTkQfatNJ9VWnQ7ZcLZcVStpaXLTeG8bGrzX3n')
  })

  it('can create a BIP32, bitcoin, account 0, external address', function () {
    const path = "m/0'/0/0"
    const root = bip32.fromSeed(Buffer.from('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'hex'))

    const child1 = root.derivePath(path)

    // option 2, manually
    const child1b = root.deriveHardened(0)
      .derive(0)
      .derive(0)

    assert.equal(getAddress(child1), '1JHyB1oPXufr4FXkfitsjgNB5yRY9jAaa7')
    assert.equal(getAddress(child1b), '1JHyB1oPXufr4FXkfitsjgNB5yRY9jAaa7')
  })

  it('can create a BIP44, bitcoin, account 0, external address', function () {
    const root = bip32.fromSeed(Buffer.from('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'hex'))

    const child1 = root.derivePath("m/44'/0'/0'/0/0")

    // option 2, manually
    const child1b = root.deriveHardened(44)
      .deriveHardened(0)
      .deriveHardened(0)
      .derive(0)
      .derive(0)

    assert.equal(getAddress(child1), '12Tyvr1U8A3ped6zwMEU5M8cx3G38sP5Au')
    assert.equal(getAddress(child1b), '12Tyvr1U8A3ped6zwMEU5M8cx3G38sP5Au')
  })

  it('can create a BIP49, bitcoin testnet, account 0, external address', function () {
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const seed = bip39.mnemonicToSeed(mnemonic)
    const root = bip32.fromSeed(seed)

    const path = "m/49'/1'/0'/0/0"
    const child = root.derivePath(path)

    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network: bitcoin.networks.testnet }),
      network: bitcoin.networks.testnet
    })
    assert.equal(address, '2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2')
  })

  it('can use BIP39 to generate BIP32 addresses', function () {
    // var mnemonic = bip39.generateMnemonic()
    const mnemonic = 'praise you muffin lion enable neck grocery crumble super myself license ghost'
    assert(bip39.validateMnemonic(mnemonic))

    const seed = bip39.mnemonicToSeed(mnemonic)
    const root = bip32.fromSeed(seed)

    // receive addresses
    assert.strictEqual(getAddress(root.derivePath("m/0'/0/0")), '1AVQHbGuES57wD68AJi7Gcobc3RZrfYWTC')
    assert.strictEqual(getAddress(root.derivePath("m/0'/0/1")), '1Ad6nsmqDzbQo5a822C9bkvAfrYv9mc1JL')

    // change addresses
    assert.strictEqual(getAddress(root.derivePath("m/0'/1/0")), '1349KVc5NgedaK7DvuD4xDFxL86QN1Hvdn')
    assert.strictEqual(getAddress(root.derivePath("m/0'/1/1")), '1EAvj4edpsWcSer3duybAd4KiR4bCJW5J6')
  })
})
