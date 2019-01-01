const { describe, it } = require('mocha')
const assert = require('assert')
const bitcoin = require('../../')
const dhttp = require('dhttp/200')
const TESTNET = bitcoin.networks.testnet

describe('bitcoinjs-lib (addresses)', function () {
  it('can generate a random address [and support the retrieval of transactions for that address (via 3PBP)', function (done) {
    const keyPair = bitcoin.ECPair.makeRandom()
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey })

    // bitcoin P2PKH addresses start with a '1'
    assert.strictEqual(address.startsWith('1'), true)

    dhttp({
      method: 'GET',
      url: 'https://blockchain.info/rawaddr/' + address
    }, function (err, result) {
      if (err) return done(err)

      // random private keys [probably!] have no transactions
      assert.strictEqual(result.n_tx, 0)
      assert.strictEqual(result.total_received, 0)
      assert.strictEqual(result.total_sent, 0)
      done()
    })
  })

  it('can import an address via WIF', function () {
    const keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey })

    assert.strictEqual(address, '19AAjaTUbRjQCMuVczepkoPswiZRhjtg31')
  })

  it('can generate a P2SH, pay-to-multisig (2-of-3) address', function () {
    const pubkeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map((hex) => Buffer.from(hex, 'hex'))
    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2ms({ m: 2, pubkeys })
    })

    assert.strictEqual(address, '36NUkt6FWUi3LAWBqWRdDmdTWbt91Yvfu7')
  })

  it('can generate a SegWit address', function () {
    const keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey })

    assert.strictEqual(address, 'bc1qt97wqg464zrhnx23upykca5annqvwkwujjglky')
  })

  it('can generate a SegWit address (via P2SH)', function () {
    const keyPair = bitcoin.ECPair.fromWIF('Kxr9tQED9H44gCmp6HAdmemAzU3n84H3dGkuWTKvE23JgHMW8gct')
    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey })
    })

    assert.strictEqual(address, '34AgLJhwXrvmkZS1o5TrcdeevMt22Nar53')
  })

  it('can generate a P2WSH (SegWit), pay-to-multisig (3-of-4) address', function () {
    const pubkeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9',
      '023e4740d0ba639e28963f3476157b7cf2fb7c6fdf4254f97099cf8670b505ea59',
      '03c6103b3b83e4a24a0e33a4df246ef11772f9992663db0c35759a5e2ebf68d8e9'
    ].map((hex) => Buffer.from(hex, 'hex'))
    const { address } = bitcoin.payments.p2wsh({
      redeem: bitcoin.payments.p2ms({ m: 3, pubkeys })
    })

    assert.strictEqual(address, 'bc1q75f6dv4q8ug7zhujrsp5t0hzf33lllnr3fe7e2pra3v24mzl8rrqtp3qul')
  })

  it('can generate a P2SH(P2WSH(...)), pay-to-multisig (2-of-2) address', function () {
    const pubkeys = [
      '026477115981fe981a6918a6297d9803c4dc04f328f22041bedff886bbc2962e01',
      '02c96db2302d19b43d4c69368babace7854cc84eb9e061cde51cfa77ca4a22b8b9'
    ].map((hex) => Buffer.from(hex, 'hex'))
    const { address } = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wsh({
        redeem: bitcoin.payments.p2ms({ m: 2, pubkeys })
      })
    })

    assert.strictEqual(address, '3P4mrxQfmExfhxqjLnR2Ah4WES5EB1KBrN')
  })

  // examples using other network information
  it('can generate a Testnet address', function () {
    const keyPair = bitcoin.ECPair.makeRandom({ network: TESTNET })
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: TESTNET })

    // bitcoin testnet P2PKH addresses start with a 'm'
    assert.strictEqual(address.startsWith('m'), true)
  })

  it('can generate a Litecoin address', function () {
    // WARNING: although possible, bitcoinjs is NOT necessarily compatible with Litecoin
    const LITECOIN = {
      messagePrefix: '\x19Litecoin Signed Message:\n',
      bip32: {
        public: 0x019da462,
        private: 0x019d9cfe
      },
      pubKeyHash: 0x30,
      scriptHash: 0x32,
      wif: 0xb0
    }

    const keyPair = bitcoin.ECPair.makeRandom({ network: LITECOIN })
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: LITECOIN })

    assert.strictEqual(address.startsWith('L'), true)
  })
})
